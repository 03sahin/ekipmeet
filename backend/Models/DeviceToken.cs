using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

// Push bildirimi gönderilecek cihaz (Expo push token'ı). Bir kullanıcının birden çok cihazı olabilir.
public class DeviceToken
{
    public int Id { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    [MaxLength(200)]
    public string Token { get; set; } = string.Empty; // Unique: aynı cihaz iki hesaba birden kayıtlı olmasın

    [MaxLength(10)]
    public string Platform { get; set; } = string.Empty; // "android" / "ios"

    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
