using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public enum NotificationType { ChatMessage, MeetingInvited, MeetingChanged, MeetingCancelled, MeetingRemoved }

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; } // Bildirimin sahibi; herkes sadece kendininkini görür
    public User User { get; set; } = null!;

    public NotificationType Type { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Body { get; set; } = string.Empty; // Mesajın tamamı değil, kısa önizleme

    // Dokununca nereye gidileceği: {"conversationId": "..."} ya da {"meetingId": "..."} (PostgreSQL'de jsonb)
    public string Data { get; set; } = "{}";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}
