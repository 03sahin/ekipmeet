using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using EkipMeet.Api.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Authorize]
public class AttachmentsController(
    AppDbContext db,
    IFileStorage storage,
    ChatNotifier notifier,
    NotificationService notifications) : ControllerBase
{
    public const long MaxFileBytes = 10 * 1024 * 1024; // 10 MB
    private const long MaxRequestBytes = MaxFileBytes + 64 * 1024; // Dosya + form alanları/başlıklar için pay
    private const int MaxCaptionLength = 1000;

    private NotFoundObjectResult AttachmentNotFound() => NotFound(new { message = "Dosya bulunamadı." });

    // Dosya yüklenir ve aynı istekte ekli bir mesaj oluşturulur: yarıda kalan/sahipsiz dosya oluşmaz.
    // Form alanları: file (zorunlu), text (isteğe bağlı açıklama)
    [HttpPost("api/conversations/{id:guid}/attachments")]
    [EnableRateLimiting(RateLimitPolicies.Upload)]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public async Task<ActionResult<ChatMessageResponse>> Upload(Guid id, IFormFile? file, [FromForm] string? text,
        CancellationToken cancellationToken)
    {
        var me = User.GetUserId();
        var conversation = await db.Conversations.Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id && c.Members.Any(m => m.UserId == me), cancellationToken);
        if (conversation is null) return NotFound(new { message = "Sohbet bulunamadı." });

        if (file is null || file.Length == 0) return BadRequest(new { message = "Dosya seçilmedi." });
        if (file.Length > MaxFileBytes) return BadRequest(new { message = "Dosya en fazla 10 MB olabilir." });

        text = text?.Trim() ?? string.Empty;
        if (text.Length > MaxCaptionLength)
            return BadRequest(new { message = $"Açıklama en fazla {MaxCaptionLength} karakter olabilir." });

        // Orijinal adın sadece son parçası (istemci "../../x.jpg" gönderse bile) ve makul uzunlukta
        var originalName = Path.GetFileName(file.FileName.Replace('\\', '/')).Trim();
        if (originalName.Length == 0) originalName = "dosya";
        if (originalName.Length > 255) originalName = originalName[^255..];

        // Tür: istemcinin Content-Type'ı yok sayılır; uzantı + dosya imzası
        await using var stream = file.OpenReadStream();
        var header = new byte[FileTypeInspector.HeaderSize];
        var headerLength = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        var contentType = FileTypeInspector.Detect(originalName, header.AsSpan(0, headerLength));
        if (contentType is null)
            return BadRequest(new { message = $"Bu dosya türü desteklenmiyor ya da içeriği uzantısıyla uyuşmuyor. İzinli türler: {FileTypeInspector.AllowedList}." });

        stream.Position = 0;
        var storageKey = await storage.SaveAsync(stream, cancellationToken);

        var attachment = new Attachment
        {
            ConversationId = id,
            UploaderId = me,
            OriginalName = originalName,
            ContentType = contentType,
            SizeBytes = file.Length,
            StorageKey = storageKey,
        };
        var message = new ChatMessage { ConversationId = id, SenderId = me, Text = text, Attachment = attachment };
        db.ChatMessages.Add(message);
        conversation.LastMessageAt = message.CreatedAt;
        conversation.Members.First(m => m.UserId == me).LastReadAt = message.CreatedAt;

        try
        {
            // İptal edilirse (istemci bağlantıyı kesti) kayıt yapılmasın; aşağıda dosya da silinir
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await storage.DeleteAsync(storageKey); // Veritabanına yazılamadıysa diskte sahipsiz dosya kalmasın
            throw;
        }

        var response = new ChatMessageResponse(message.Id, id, me, User.GetDisplayName(), text, message.CreatedAt,
            new AttachmentResponse(attachment.Id, originalName, contentType, attachment.SizeBytes, attachment.IsImage));
        await notifier.MessageSent(conversation.Members.Select(m => m.UserId), response);
        await notifications.ChatMessage(conversation, message, User.GetDisplayName(), attachment);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpGet("api/attachments/{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var me = User.GetUserId();
        // Sadece şu an sohbetin üyesi olan indirebilir; gruptan ayrılan artık indiremez. Değilse 404.
        var attachment = await db.Attachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.Conversation.Members.Any(m => m.UserId == me), cancellationToken);
        if (attachment is null) return AttachmentNotFound();

        var stream = await storage.OpenReadAsync(attachment.StorageKey, cancellationToken);
        if (stream is null) return AttachmentNotFound();

        // Resimler tarayıcıda/uygulamada gösterilsin (inline), diğerleri indirilsin (attachment).
        // FileNameStar: Türkçe karakterli adlar da bozulmadan gider.
        var disposition = new ContentDispositionHeaderValue(attachment.IsImage ? "inline" : "attachment")
        {
            FileNameStar = attachment.OriginalName,
        };
        Response.Headers.ContentDisposition = disposition.ToString();
        Response.Headers.XContentTypeOptions = "nosniff"; // Tarayıcı türü tahmin etmeye çalışmasın
        Response.Headers.CacheControl = "private, max-age=3600"; // Sadece bu kullanıcının cihazında önbelleklensin

        return File(stream, attachment.ContentType, enableRangeProcessing: true);
    }
}
