using System.Linq.Expressions;
using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/meetings")]
[Authorize]
public class MeetingsController(
    AppDbContext db,
    MeetingNotifier notifier,
    CallNotifier callNotifier,
    NotificationService notifications) : ControllerBase
{
    private const int MaxParticipants = 50; // Düzenleyen hariç davet edilebilecek kişi sayısı
    private const int MaxRangeDays = 100; // Takvim tek seferde en fazla bu kadar günlük aralık ister
    private const int UpcomingLimit = 20;
    private const int InstantDurationMinutes = 60;

    // Katılımcı olmayana 403 değil 404: toplantının varlığı bile sızmasın
    private NotFoundObjectResult MeetingNotFound() => NotFound(new { message = "Toplantı bulunamadı." });

    private ObjectResult OrganizerOnly(string action) =>
        StatusCode(StatusCodes.Status403Forbidden, new { message = $"Bu toplantıyı sadece düzenleyen {action}." });

    // Takvim satırı: benim katılımcı satırımdan başlar, toplantı bilgisini oradan okur
    private static readonly Expression<Func<MeetingParticipant, MeetingSummary>> ToSummary = p => new MeetingSummary(
        p.MeetingId,
        p.Meeting.Title,
        p.Meeting.StartsAt,
        p.Meeting.EndsAt,
        p.Meeting.DurationMinutes,
        p.Meeting.IsInstant,
        p.Meeting.Status,
        p.Meeting.OrganizerId,
        p.Meeting.Organizer.DisplayName,
        p.Role == ParticipantRole.Organizer,
        p.Response,
        p.Meeting.Participants.Count,
        p.Meeting.Participants.Count(x => x.Response == ParticipantResponse.Accepted));

    // Toplantıyı katılımcılarıyla getirir; kullanıcı katılımcı değilse null (yani 404)
    private Task<Meeting?> FindForParticipant(Guid id, Guid userId) =>
        db.Meetings.Include(m => m.Participants)
            .FirstOrDefaultAsync(m => m.Id == id && m.Participants.Any(p => p.UserId == userId));

    // İptal edilmiş ya da bitmiş toplantı değiştirilemez; engel varsa nedenini döner
    private static string? ChangeBlockedReason(Meeting meeting, string action)
    {
        if (meeting.Status == MeetingStatus.Cancelled) return $"İptal edilmiş toplantı {action}.";
        if (meeting.HasEnded(DateTime.UtcNow)) return $"Bitmiş toplantı {action}.";
        return null;
    }

    [HttpGet]
    public async Task<ActionResult<List<MeetingSummary>>> GetRange([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to)
    {
        if (from is null || to is null)
            return BadRequest(new { message = "from ve to tarihleri zorunludur." });

        var start = from.Value.UtcDateTime;
        var end = to.Value.UtcDateTime;
        if (end <= start) return BadRequest(new { message = "Bitiş tarihi başlangıçtan sonra olmalı." });
        if ((end - start).TotalDays > MaxRangeDays)
            return BadRequest(new { message = $"Tarih aralığı en fazla {MaxRangeDays} gün olabilir." });

        var me = User.GetUserId();
        // Aralıkla çakışan toplantılar (aralıktan önce başlayıp içine sarkanlar dahil). İptaller de gelir; takvimde "iptal" görünür.
        var meetings = await db.MeetingParticipants.AsNoTracking()
            .Where(p => p.UserId == me && p.Meeting.StartsAt < end && p.Meeting.EndsAt > start)
            .OrderBy(p => p.Meeting.StartsAt)
            .Select(ToSummary)
            .ToListAsync();

        return Ok(meetings);
    }

    [HttpGet("upcoming")]
    public async Task<ActionResult<List<MeetingSummary>>> GetUpcoming()
    {
        var me = User.GetUserId();
        var now = DateTime.UtcNow;
        // Bitmemiş (şu an süren dahil) ve iptal edilmemiş
        var meetings = await db.MeetingParticipants.AsNoTracking()
            .Where(p => p.UserId == me && p.Meeting.Status == MeetingStatus.Scheduled && p.Meeting.EndsAt > now)
            .OrderBy(p => p.Meeting.StartsAt)
            .Take(UpcomingLimit)
            .Select(ToSummary)
            .ToListAsync();

        return Ok(meetings);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MeetingDetail>> GetById(Guid id)
    {
        var detail = await LoadDetail(id, User.GetUserId());
        return detail is null ? MeetingNotFound() : Ok(detail);
    }

    [HttpPost]
    public async Task<ActionResult<MeetingDetail>> Create(CreateMeetingRequest request)
    {
        var me = User.GetUserId();
        var title = request.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Toplantı başlığı zorunludur." });

        var startsAt = request.StartsAt!.Value.UtcDateTime;
        if (startsAt <= DateTime.UtcNow) return BadRequest(new { message = "Başlangıç zamanı gelecekte olmalı." });

        var (participantIds, error) = await ValidateParticipants(request.ParticipantIds, me);
        if (error is not null) return BadRequest(new { message = error });

        var meeting = NewMeeting(me, title, request.Description, startsAt, request.DurationMinutes, isInstant: false, participantIds);
        db.Meetings.Add(meeting);
        await db.SaveChangesAsync();

        await notifier.Invited(participantIds, meeting.Id);
        await notifications.Meeting(participantIds, NotificationType.MeetingInvited, meeting, User.GetDisplayName());
        await notifier.Changed([me], meeting.Id); // Düzenleyenin diğer cihazlarındaki takvim de güncellensin
        return CreatedAtAction(nameof(GetById), new { id = meeting.Id }, await LoadDetail(meeting.Id, me));
    }

    [HttpPost("instant")]
    public async Task<ActionResult<MeetingDetail>> CreateInstant(InstantMeetingRequest request)
    {
        var me = User.GetUserId();
        var title = string.IsNullOrWhiteSpace(request.Title) ? "Hızlı toplantı" : request.Title.Trim();

        var (participantIds, error) = await ValidateParticipants(request.ParticipantIds ?? [], me);
        if (error is not null) return BadRequest(new { message = error });

        // Saniyeye yuvarlıyoruz: istemci saati milisaniyeyle geri yollasa da "saat değişti" sanılmasın
        var now = DateTime.UtcNow;
        var startsAt = new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);

        var meeting = NewMeeting(me, title, null, startsAt, InstantDurationMinutes, isInstant: true, participantIds);
        db.Meetings.Add(meeting);
        await db.SaveChangesAsync();

        await notifier.Invited(participantIds, meeting.Id);
        await notifications.Meeting(participantIds, NotificationType.MeetingInvited, meeting, User.GetDisplayName());
        await notifier.Changed([me], meeting.Id);
        return CreatedAtAction(nameof(GetById), new { id = meeting.Id }, await LoadDetail(meeting.Id, me));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MeetingDetail>> Update(Guid id, UpdateMeetingRequest request)
    {
        var me = User.GetUserId();
        var meeting = await FindForParticipant(id, me);
        if (meeting is null) return MeetingNotFound();
        if (meeting.OrganizerId != me) return OrganizerOnly("düzenleyebilir");
        if (ChangeBlockedReason(meeting, "düzenlenemez") is { } blocked) return BadRequest(new { message = blocked });

        var title = request.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Toplantı başlığı zorunludur." });

        var now = DateTime.UtcNow;
        var startsAt = request.StartsAt!.Value.UtcDateTime;
        // 1 sn'den küçük farkları yok say (veritabanı ve JavaScript saat hassasiyetleri farklı)
        var startChanged = Math.Abs((startsAt - meeting.StartsAt).TotalSeconds) >= 1;
        if (!startChanged) startsAt = meeting.StartsAt;
        else if (startsAt <= now) return BadRequest(new { message = "Yeni başlangıç zamanı gelecekte olmalı." });

        if (startsAt.AddMinutes(request.DurationMinutes) <= now)
            return BadRequest(new { message = "Bu süreyle toplantı geçmişte bitmiş olur." });

        var timeChanged = startChanged || request.DurationMinutes != meeting.DurationMinutes;

        meeting.Title = title;
        meeting.Description = request.Description?.Trim() ?? string.Empty;
        meeting.SetSchedule(startsAt, request.DurationMinutes);
        meeting.UpdatedAt = now;

        // Saat değiştiyse eski "katılıyorum" yanıtları geçersiz: herkes yeni saate göre tekrar yanıtlasın
        if (timeChanged)
        {
            foreach (var p in meeting.Participants.Where(p => p.Role == ParticipantRole.Participant))
            {
                p.Response = ParticipantResponse.Pending;
                p.RespondedAt = null;
            }
        }
        await db.SaveChangesAsync();

        await notifier.Changed(meeting.Participants.Select(p => p.UserId), id);
        await notifications.Meeting(Others(meeting, me), NotificationType.MeetingChanged, meeting, User.GetDisplayName());
        return Ok(await LoadDetail(id, me));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<MeetingDetail>> Cancel(Guid id)
    {
        var me = User.GetUserId();
        var meeting = await FindForParticipant(id, me);
        if (meeting is null) return MeetingNotFound();
        if (meeting.OrganizerId != me) return OrganizerOnly("iptal edebilir");
        if (meeting.Status == MeetingStatus.Cancelled) return BadRequest(new { message = "Toplantı zaten iptal edilmiş." });
        if (meeting.HasEnded(DateTime.UtcNow)) return BadRequest(new { message = "Bitmiş toplantı iptal edilemez." });

        meeting.Status = MeetingStatus.Cancelled; // Silmiyoruz: katılımcılar "iptal edildi" olarak görsün
        meeting.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await notifier.Cancelled(meeting.Participants.Select(p => p.UserId), id);
        await notifications.Meeting(Others(meeting, me), NotificationType.MeetingCancelled, meeting, User.GetDisplayName());
        await callNotifier.EndCall(CallTracker.MeetingKey(id), "Toplantı düzenleyen tarafından iptal edildi.");
        return Ok(await LoadDetail(id, me));
    }

    [HttpPost("{id:guid}/respond")]
    public async Task<ActionResult<MeetingDetail>> Respond(Guid id, RespondMeetingRequest request)
    {
        var me = User.GetUserId();
        var meeting = await FindForParticipant(id, me);
        if (meeting is null) return MeetingNotFound();

        var mine = meeting.Participants.First(p => p.UserId == me);
        if (mine.Role == ParticipantRole.Organizer)
            return BadRequest(new { message = "Düzenleyen olarak zaten katılıyorsun." });
        if (request.Response is not (ParticipantResponse.Accepted or ParticipantResponse.Declined))
            return BadRequest(new { message = "Yanıt Accepted ya da Declined olmalı." });
        if (ChangeBlockedReason(meeting, "yanıtlanamaz") is { } blocked) return BadRequest(new { message = blocked });

        mine.Response = request.Response.Value;
        mine.RespondedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await notifier.Changed(meeting.Participants.Select(p => p.UserId), id); // Düzenleyen yanıtı canlı görsün
        return Ok(await LoadDetail(id, me));
    }

    [HttpPost("{id:guid}/participants")]
    public async Task<ActionResult<MeetingDetail>> AddParticipant(Guid id, AddParticipantRequest request)
    {
        var me = User.GetUserId();
        var meeting = await FindForParticipant(id, me);
        if (meeting is null) return MeetingNotFound();
        if (meeting.OrganizerId != me) return OrganizerOnly("katılımcı ekleyebilir");
        if (ChangeBlockedReason(meeting, "değiştirilemez") is { } blocked) return BadRequest(new { message = blocked });

        var userId = request.UserId!.Value;
        if (meeting.Participants.Any(p => p.UserId == userId))
            return Conflict(new { message = "Bu kişi zaten davetli." });
        if (meeting.Participants.Count(p => p.Role == ParticipantRole.Participant) >= MaxParticipants)
            return BadRequest(new { message = $"Bir toplantıya en fazla {MaxParticipants} kişi davet edilebilir." });
        if (!await db.Users.AnyAsync(u => u.Id == userId))
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        var existing = meeting.Participants.Select(p => p.UserId).ToList();
        db.MeetingParticipants.Add(new MeetingParticipant { MeetingId = id, UserId = userId });
        await db.SaveChangesAsync();

        await notifier.Invited([userId], id);
        await notifications.Meeting([userId], NotificationType.MeetingInvited, meeting, User.GetDisplayName());
        await notifier.Changed(existing, id);
        return Ok(await LoadDetail(id, me));
    }

    [HttpDelete("{id:guid}/participants/{userId:guid}")]
    public async Task<ActionResult<MeetingDetail>> RemoveParticipant(Guid id, Guid userId)
    {
        var me = User.GetUserId();
        var meeting = await FindForParticipant(id, me);
        if (meeting is null) return MeetingNotFound();
        if (meeting.OrganizerId != me) return OrganizerOnly("katılımcı çıkarabilir");
        if (ChangeBlockedReason(meeting, "değiştirilemez") is { } blocked) return BadRequest(new { message = blocked });
        if (userId == me) return BadRequest(new { message = "Düzenleyen toplantıdan çıkarılamaz." });

        var target = meeting.Participants.FirstOrDefault(p => p.UserId == userId);
        if (target is null) return NotFound(new { message = "Katılımcı bulunamadı." });

        db.MeetingParticipants.Remove(target);
        await db.SaveChangesAsync();

        await notifier.Removed(userId, id);
        await notifications.Meeting([userId], NotificationType.MeetingRemoved, meeting, User.GetDisplayName());
        await notifier.Changed(meeting.Participants.Where(p => p.UserId != userId).Select(p => p.UserId), id);
        // Çıkarılan kişi görüşmedeyse artık yetkisi yok
        await callNotifier.RemoveUser(CallTracker.MeetingKey(id), userId, "Düzenleyen seni toplantıdan çıkardı.");
        return Ok(await LoadDetail(id, me));
    }

    // Düzenleyenin kendi yaptığı değişiklik için kendisine bildirim gitmez
    private static IEnumerable<Guid> Others(Meeting meeting, Guid me) =>
        meeting.Participants.Select(p => p.UserId).Where(id => id != me);

    private async Task<(List<Guid> Ids, string? Error)> ValidateParticipants(IEnumerable<Guid> raw, Guid me)
    {
        // Tekrar edenler ve düzenleyenin kendisi ayıklanır
        var ids = raw.Where(id => id != me && id != Guid.Empty).Distinct().ToList();
        if (ids.Count > MaxParticipants)
            return (ids, $"Bir toplantıya en fazla {MaxParticipants} kişi davet edilebilir.");
        if (ids.Count > 0 && await db.Users.CountAsync(u => ids.Contains(u.Id)) != ids.Count)
            return (ids, "Seçilen kullanıcılardan bazıları bulunamadı.");
        return (ids, null);
    }

    private static Meeting NewMeeting(Guid organizerId, string title, string? description, DateTime startsAt,
        int durationMinutes, bool isInstant, List<Guid> participantIds)
    {
        var meeting = new Meeting
        {
            Title = title,
            Description = description?.Trim() ?? string.Empty,
            OrganizerId = organizerId, // Token'dan; istemci başkası adına toplantı açamaz
            IsInstant = isInstant,
        };
        meeting.SetSchedule(startsAt, durationMinutes);
        // Düzenleyen de katılımcı tablosunda; otomatik "katılıyor"
        meeting.Participants.Add(new MeetingParticipant
        {
            UserId = organizerId,
            Role = ParticipantRole.Organizer,
            Response = ParticipantResponse.Accepted,
            RespondedAt = DateTime.UtcNow,
        });
        meeting.Participants.AddRange(participantIds.Select(id => new MeetingParticipant { UserId = id }));
        return meeting;
    }

    private async Task<MeetingDetail?> LoadDetail(Guid id, Guid me)
    {
        var m = await db.Meetings.AsNoTracking()
            .Where(m => m.Id == id && m.Participants.Any(p => p.UserId == me))
            .Select(m => new
            {
                Meeting = m,
                OrganizerName = m.Organizer.DisplayName,
                Participants = m.Participants
                    .OrderByDescending(p => p.Role == ParticipantRole.Organizer) // Düzenleyen en üstte
                    .ThenBy(p => p.User.DisplayName)
                    .Select(p => new MeetingParticipantResponse(p.UserId, p.User.DisplayName, p.Role, p.Response, p.RespondedAt))
                    .ToList(),
            })
            .FirstOrDefaultAsync();
        if (m is null) return null;

        var meeting = m.Meeting;
        return new MeetingDetail(
            meeting.Id, meeting.Title, meeting.Description, meeting.StartsAt, meeting.EndsAt, meeting.DurationMinutes,
            meeting.IsInstant, meeting.Status, meeting.OrganizerId, m.OrganizerName, meeting.OrganizerId == me,
            m.Participants.First(p => p.UserId == me).Response, meeting.CreatedAt, meeting.UpdatedAt, m.Participants);
    }
}
