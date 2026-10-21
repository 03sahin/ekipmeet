using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EkipMeet.Api.Models;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace EkipMeet.Api.Services;

public class TokenService(IConfiguration config)
{
    // Kısa ömürlü erişim token'ı (JWT): her API isteğinde gönderilir
    public (string Token, DateTime ExpiresAt) CreateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var expiresAt = DateTime.UtcNow.AddMinutes(config.GetValue("Jwt:AccessTokenMinutes", 15));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()), // Kullanıcı kimliği
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("name", user.DisplayName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // Token'a özgü kimlik
            ]),
            Expires = expiresAt,
            Issuer = config["Jwt:Issuer"],
            Audience = config["Jwt:Audience"],
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expiresAt);
    }

    // Uzun ömürlü yenileme token'ı: tahmin edilemez rastgele 64 bayt
    public string CreateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    // Veritabanına token'ın kendisini değil özetini yazarız; veritabanı sızsa bile kullanılamaz
    public string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}