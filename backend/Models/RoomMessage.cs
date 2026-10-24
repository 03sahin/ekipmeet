using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public class RoomMessage
{
    public long Id { get; set; } // Mesaj sayısı hızla artabilir, long kullanıyoruz

    public int RoomId { get; set; }
    public Room Room { get; set; } = null!; // Oda silinince mesajları da silinir (cascade)

    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;

    [MaxLength(1000)]
    public string Text { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
