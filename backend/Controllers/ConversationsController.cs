using System.Linq.Expressions;
using System.Text.Json;
using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using EkipMeet.Api.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/conversations")]
[Authorize]
public class ConversationsController(
    AppDbContext db,
    ChatNotifier notifier,
    NotificationService notifications,
    ConversationPresence conversationPresence,
    IFileStorage storage) : ControllerBase
{
    private const int MaxPageSize = 100;

    // Üye olmayana 403 değil 404: "böyle bir sohbet var ama giremezsin" bilgisi bile sızmasın
    private NotFoundObjectResult ConversationNotFound() => NotFound(new { message = "Sohbet bulunamadı." });

    // IsImage hesaplanan bir özellik, SQL'e çevrilemez; aynı kuralı burada açıkça yazıyoruz
    private static readonly Expression<Func<ChatMessage, ChatMessageResponse>> ToMessageResponse =
        m => new ChatMessageResponse(m.Id, m.ConversationId, m.SenderId, m.Sender.DisplayName, m.Text, m.CreatedAt,
            m.Attachment == null
                ? null
                : new AttachmentResponse(m.Attachment.Id, m.Attachment.OriginalName, m.Attachment.ContentType,
                    m.Attachment.SizeBytes, m.Attachment.ContentType.StartsWith("image/")));

    // Sohbeti üyeleriyle getirir; kullanıcı üye değilse null (yani 404)
    private Task<Conversation?> FindForMember(Guid id, Guid userId) =>
        db.Conversations.Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id && c.Members.Any(m => m.UserId == userId));

    [HttpGet]
    public async Task<ActionResult<List<ConversationSummary>>> GetAll()
    {
        var me = User.GetUserId();
        // Üyelik tablosundan başlıyoruz: sadece üyesi olduğum sohbetler gelir
        var conversations = await db.ConversationMembers.AsNoTracking()
            .Where(m => m.UserId == me)
            .OrderByDescending(m => m.Conversation.LastMessageAt)
            .Select(m => new ConversationSummary(
                m.ConversationId,
                m.Conversation.Type,
                m.Conversation.Type == ConversationType.Group
                    ? m.Conversation.Name!
                    : m.Conversation.Members.Where(o => o.UserId != me).Select(o => o.User.DisplayName).FirstOrDefault() ?? "",
                m.Conversation.Messages
                    .OrderByDescending(x => x.Id)
                    .Select(x => new LastMessagePreview(x.SenderId, x.Sender.DisplayName, x.Text, x.CreatedAt,
                        x.Attachment != null ? x.Attachment.OriginalName : null,
                        x.Attachment != null && x.Attachment.ContentType.StartsWith("image/")))
                    .FirstOrDefault(),
                m.Conversation.LastMessageAt,
                // Okunmamış: başkalarının, son okuduğum andan sonra yazdıkları
                m.Conversation.Messages.Count(x => x.SenderId != me && x.CreatedAt > m.LastReadAt)))
            .ToListAsync();

        return Ok(conversations);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ConversationDetail>> GetById(Guid id)
    {
        var detail = await LoadDetail(id, User.GetUserId());
        return detail is null ? ConversationNotFound() : Ok(detail);
    }

    [HttpPost("direct")]
    public async Task<ActionResult<ConversationDetail>> CreateDirect(CreateDirectRequest request)
    {
        var me = User.GetUserId();
        var otherId = request.UserId!.Value;
        if (otherId == me) return BadRequest(new { message = "Kendinle sohbet başlatamazsın." });
        if (!await db.Users.AnyAsync(u => u.Id == otherId)) return NotFound(new { message = "Kullanıcı bulunamadı." });

        // Zaten varsa yenisini açma, mevcut olanı döndür
        var key = Conversation.CreateDirectKey(me, otherId);
        var existingId = await db.Conversations.Where(c => c.DirectKey == key).Select(c => (Guid?)c.Id).FirstOrDefaultAsync();
        if (existingId is not null) return Ok(await LoadDetail(existingId.Value, me));

        var conversation = new Conversation { Type = ConversationType.Direct, DirectKey = key, CreatedById = me };
        conversation.Members.Add(new ConversationMember { UserId = me });
        conversation.Members.Add(new ConversationMember { UserId = otherId });
        db.Conversations.Add(conversation);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // İki kişi aynı anda birbirine yazmaya başladıysa unique index ikinci kaydı reddeder; onunkini döndür
            var id = await db.Conversations.Where(c => c.DirectKey == key).Select(c => c.Id).FirstAsync();
            return Ok(await LoadDetail(id, me));
        }

        await notifier.ConversationChanged([me, otherId], conversation.Id);
        return CreatedAtAction(nameof(GetById), new { id = conversation.Id }, await LoadDetail(conversation.Id, me));
    }

    [HttpPost("group")]
    public async Task<ActionResult<ConversationDetail>> CreateGroup(CreateGroupRequest request)
    {
        var me = User.GetUserId();
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest(new { message = "Grup adı zorunludur." });

        var memberIds = request.MemberIds.Where(id => id != me).Distinct().ToList();
        if (memberIds.Count == 0) return BadRequest(new { message = "Gruba en az 1 kişi daha eklemelisin." });
        if (await db.Users.CountAsync(u => memberIds.Contains(u.Id)) != memberIds.Count)
            return BadRequest(new { message = "Seçilen kullanıcılardan bazıları bulunamadı." });

        // Oluşturan kişi token'dan gelir ve Owner olur; istemci rol gönderemez
        var conversation = new Conversation { Type = ConversationType.Group, Name = name, CreatedById = me };
        conversation.Members.Add(new ConversationMember { UserId = me, Role = MemberRole.Owner });
        conversation.Members.AddRange(memberIds.Select(id => new ConversationMember { UserId = id }));
        db.Conversations.Add(conversation);
        await db.SaveChangesAsync();

        await notifier.ConversationChanged(conversation.Members.Select(m => m.UserId), conversation.Id);
        return CreatedAtAction(nameof(GetById), new { id = conversation.Id }, await LoadDetail(conversation.Id, me));
    }

    // Sayfalama: before verilmezse en yeni mesajlar, verilirse o id'den eskiler. Dönüş eskiden yeniye sıralı.
    [HttpGet("{id:guid}/messages")]
    public async Task<ActionResult<List<ChatMessageResponse>>> GetMessages(Guid id, [FromQuery] long? before, [FromQuery] int limit = 50)
    {
        var me = User.GetUserId();
        if (!await db.ConversationMembers.AnyAsync(m => m.ConversationId == id && m.UserId == me))
            return ConversationNotFound();

        limit = Math.Clamp(limit, 1, MaxPageSize);
        var query = db.ChatMessages.AsNoTracking().Where(m => m.ConversationId == id);
        if (before is not null) query = query.Where(m => m.Id < before);

        var messages = await query.OrderByDescending(m => m.Id).Take(limit).Select(ToMessageResponse).ToListAsync();
        messages.Reverse();
        return Ok(messages);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<ActionResult<ChatMessageResponse>> SendMessage(Guid id, SendChatMessageRequest request)
    {
        var me = User.GetUserId();
        var conversation = await FindForMember(id, me);
        if (conversation is null) return ConversationNotFound();

        var text = request.Text.Trim();
        if (text.Length == 0) return BadRequest(new { message = "Mesaj boş olamaz." });

        var message = new ChatMessage { ConversationId = id, SenderId = me, Text = text };
        db.ChatMessages.Add(message);
        conversation.LastMessageAt = message.CreatedAt;
        conversation.Members.First(m => m.UserId == me).LastReadAt = message.CreatedAt; // Kendi mesajın okunmuş sayılır
        await db.SaveChangesAsync();

        var response = new ChatMessageResponse(message.Id, id, me, User.GetDisplayName(), text, message.CreatedAt, null);
        await notifier.MessageSent(conversation.Members.Select(m => m.UserId), response);
        await notifications.ChatMessage(conversation, message, User.GetDisplayName(), attachment: null);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var me = User.GetUserId();
        // Sadece kendi üyelik satırımı günceller; üye değilsem 0 satır → 404
        var updated = await db.ConversationMembers
            .Where(m => m.ConversationId == id && m.UserId == me)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.LastReadAt, DateTime.UtcNow));
        if (updated == 0) return ConversationNotFound();

        // Sohbeti okuyan, o sohbetin mesaj bildirimlerini de okumuş sayılır (zil rozeti düşsün)
        var dataFilter = JsonSerializer.Serialize(new Dictionary<string, string> { ["conversationId"] = id.ToString() });
        var readNotifications = await db.Notifications
            .Where(n => n.UserId == me && n.ReadAt == null && n.Type == NotificationType.ChatMessage
                && EF.Functions.JsonContains(n.Data, dataFilter))
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        if (readNotifications > 0) await notifier.NotificationsChanged(me);
        return NoContent();
    }

    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<ConversationDetail>> AddMember(Guid id, AddMemberRequest request)
    {
        var me = User.GetUserId();
        var conversation = await FindForMember(id, me);
        if (conversation is null) return ConversationNotFound();

        if (conversation.Type != ConversationType.Group)
            return BadRequest(new { message = "Birebir sohbete üye eklenemez." });
        if (conversation.Members.First(m => m.UserId == me).Role != MemberRole.Owner)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Sadece grup sahibi üye ekleyebilir." });

        var userId = request.UserId!.Value;
        if (conversation.Members.Any(m => m.UserId == userId))
            return Conflict(new { message = "Bu kişi zaten grupta." });
        if (!await db.Users.AnyAsync(u => u.Id == userId))
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        db.ConversationMembers.Add(new ConversationMember { ConversationId = id, UserId = userId });
        await db.SaveChangesAsync();

        // Yeni üye de dahil herkes: yeni üyenin listesinde grup belirir, diğerlerinde üye listesi güncellenir
        await notifier.ConversationChanged(conversation.Members.Select(m => m.UserId).Append(userId), id);
        return Ok(await LoadDetail(id, me));
    }

    [HttpPost("{id:guid}/leave")]
    public async Task<IActionResult> Leave(Guid id)
    {
        var me = User.GetUserId();
        var conversation = await FindForMember(id, me);
        if (conversation is null) return ConversationNotFound();

        if (conversation.Type != ConversationType.Group)
            return BadRequest(new { message = "Birebir sohbetten ayrılamazsın." });

        var mine = conversation.Members.First(m => m.UserId == me);
        var remaining = conversation.Members.Where(m => m.UserId != me).ToList();
        db.ConversationMembers.Remove(mine);

        // Ayrılan kişi artık üye değil; dosya erişimi üyelik kontrolüyle zaten kesilir
        List<string> filesToDelete = [];
        if (remaining.Count == 0)
        {
            // Son kişi de çıktı: sohbet, mesajlar ve ek kayıtları cascade ile silinir; dosyaları biz sileriz
            filesToDelete = await db.Attachments.Where(a => a.ConversationId == id).Select(a => a.StorageKey).ToListAsync();
            db.Conversations.Remove(conversation);
        }
        else if (mine.Role == MemberRole.Owner && remaining.All(m => m.Role != MemberRole.Owner))
        {
            // Grup sahipsiz kalmasın: en eski üye yeni sahip olur
            remaining.OrderBy(m => m.JoinedAt).ThenBy(m => m.UserId).First().Role = MemberRole.Owner;
        }
        await db.SaveChangesAsync();
        // Kayıtlar silindikten SONRA: silme başarısız olursa dosyalar hâlâ erişilebilir kalırdı
        foreach (var key in filesToDelete) await storage.DeleteAsync(key);

        conversationPresence.CloseForUser(me, id);
        await notifier.ConversationRemoved(me, id);
        if (remaining.Count > 0) await notifier.ConversationChanged(remaining.Select(m => m.UserId), id);
        return NoContent();
    }

    private async Task<ConversationDetail?> LoadDetail(Guid id, Guid me)
    {
        var c = await db.Conversations.AsNoTracking()
            .Where(c => c.Id == id && c.Members.Any(m => m.UserId == me))
            .Select(c => new
            {
                c.Id,
                c.Type,
                c.Name,
                c.CreatedAt,
                Members = c.Members
                    .OrderBy(m => m.JoinedAt)
                    .Select(m => new ConversationMemberResponse(m.UserId, m.User.DisplayName, m.Role, m.JoinedAt))
                    .ToList(),
            })
            .FirstOrDefaultAsync();
        if (c is null) return null;

        var title = c.Type == ConversationType.Group
            ? c.Name!
            : c.Members.FirstOrDefault(m => m.UserId != me)?.DisplayName ?? "";
        var myRole = c.Members.First(m => m.UserId == me).Role;
        return new ConversationDetail(c.Id, c.Type, title, myRole, c.CreatedAt, c.Members);
    }
}
