using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid(); // Tahmin edilemez kimlik

    [MaxLength(256)]
    public string Email { get; set; } = string.Empty; // Hep küçük harfle saklanır

    [MaxLength(50)]
    public string DisplayName { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty; // Şifrenin kendisi ASLA saklanmaz

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<RefreshToken> RefreshTokens { get; set; } = [];
}