using System.ComponentModel.DataAnnotations;
using EkipMeet.Api.Models;

namespace EkipMeet.Api.Dtos;

// Takvim ve "Yaklaşan" listesindeki bir toplantı
public record MeetingSummary(
    Guid Id,
    string Title,
    DateTime StartsAt,
    DateTime EndsAt,
    int DurationMinutes,
    bool IsInstant,
    MeetingStatus Status,
    Guid OrganizerId,
    string OrganizerName,
    bool IsOrganizer,
    ParticipantResponse MyResponse,
    int ParticipantCount,
    int AcceptedCount);

public record MeetingParticipantResponse(
    Guid UserId,
    string DisplayName,
    ParticipantRole Role,
    ParticipantResponse Response,
    DateTime? RespondedAt);

public record MeetingDetail(
    Guid Id,
    string Title,
    string Description,
    DateTime StartsAt,
    DateTime EndsAt,
    int DurationMinutes,
    bool IsInstant,
    MeetingStatus Status,
    Guid OrganizerId,
    string OrganizerName,
    bool IsOrganizer,
    ParticipantResponse MyResponse,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<MeetingParticipantResponse> Participants);

public class CreateMeetingRequest
{
    [Required(ErrorMessage = "Toplantı başlığı zorunludur.")]
    [MaxLength(150, ErrorMessage = "Başlık en fazla 150 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000, ErrorMessage = "Açıklama en fazla 1000 karakter olabilir.")]
    public string? Description { get; set; }

    // DateTimeOffset: "...Z" ya da "+03:00" ile gelen saat her durumda doğru UTC'ye çevrilir
    [Required(ErrorMessage = "Başlangıç zamanı zorunludur.")]
    public DateTimeOffset? StartsAt { get; set; }

    [Range(15, 480, ErrorMessage = "Süre 15 ile 480 dakika arasında olmalı.")]
    public int DurationMinutes { get; set; }

    // Tekilleştirmeden önceki ham liste için kaba bir üst sınır; asıl 50 kişi kontrolü controller'da
    [MaxLength(200)]
    public List<Guid> ParticipantIds { get; set; } = [];
}

// Katılımcılar burada değil, ayrı endpoint'lerle yönetilir
public class UpdateMeetingRequest
{
    [Required(ErrorMessage = "Toplantı başlığı zorunludur.")]
    [MaxLength(150, ErrorMessage = "Başlık en fazla 150 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000, ErrorMessage = "Açıklama en fazla 1000 karakter olabilir.")]
    public string? Description { get; set; }

    [Required(ErrorMessage = "Başlangıç zamanı zorunludur.")]
    public DateTimeOffset? StartsAt { get; set; }

    [Range(15, 480, ErrorMessage = "Süre 15 ile 480 dakika arasında olmalı.")]
    public int DurationMinutes { get; set; }
}

public class InstantMeetingRequest
{
    [MaxLength(150, ErrorMessage = "Başlık en fazla 150 karakter olabilir.")]
    public string? Title { get; set; }

    [MaxLength(200)]
    public List<Guid>? ParticipantIds { get; set; }
}

public class RespondMeetingRequest
{
    [Required(ErrorMessage = "Yanıt seçilmedi.")]
    public ParticipantResponse? Response { get; set; }
}

public class AddParticipantRequest
{
    [Required(ErrorMessage = "Kullanıcı seçilmedi.")]
    public Guid? UserId { get; set; }
}
