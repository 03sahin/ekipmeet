using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public enum MeetingStatus { Scheduled, Cancelled }

public class Meeting
{
    public Guid Id { get; set; } = Guid.NewGuid(); // Tahmin edilemez: id deneyerek başkasının toplantısı bulunamasın

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    public DateTime StartsAt { get; set; } // Her zaman UTC; mobil cihazın yerel saatine çevirir
    public int DurationMinutes { get; set; }

    // StartsAt + süre. Ayrı sütun olarak tutuyoruz ki "bitmemiş toplantılar" ve
    // "bu tarih aralığına düşenler" sorguları basit ve index'lenebilir olsun. Sadece SetSchedule ile değişir.
    public DateTime EndsAt { get; private set; }

    public Guid OrganizerId { get; set; }
    public User Organizer { get; set; } = null!;

    public bool IsInstant { get; set; }
    public MeetingStatus Status { get; set; } = MeetingStatus.Scheduled;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public List<MeetingParticipant> Participants { get; set; } = [];

    public void SetSchedule(DateTime startsAt, int durationMinutes)
    {
        StartsAt = startsAt;
        DurationMinutes = durationMinutes;
        EndsAt = startsAt.AddMinutes(durationMinutes);
    }

    public bool HasEnded(DateTime now) => EndsAt <= now;
}
