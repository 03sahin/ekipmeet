using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    [MaxLength(128)]
    public string TokenHash { get; set; } = string.Empty; // Token'ın kendisi değil, SHA-256 özeti

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; } // Doluysa iptal edilmiş

    // Sadece getter → veritabanına sütun olarak yazılmaz
    public bool IsActive => RevokedAt == null && ExpiresAt > DateTime.UtcNow;
}