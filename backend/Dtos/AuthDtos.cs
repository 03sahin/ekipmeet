using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Dtos;

public class RegisterRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(8, ErrorMessage = "Şifre en az 8 karakter olmalı."), MaxLength(100)]
    public string Password { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string DisplayName { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    // Üst sınır: çok uzun bir şifreyi hash'letip sunucuyu yormak (DoS) mümkün olmasın
    [Required, MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}

public class RefreshRequest
{
    [Required, MaxLength(200)] // Bizim ürettiğimiz token 88 karakter
    public string RefreshToken { get; set; } = string.Empty;
}

public record UserResponse(Guid Id, string Email, string DisplayName);

public record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    UserResponse User);