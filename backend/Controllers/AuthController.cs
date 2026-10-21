using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, IConfiguration config) : ControllerBase
{
    private readonly PasswordHasher<User> _hasher = new(); // PBKDF2 + salt ile güvenli hash

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "Bu e-posta zaten kayıtlı." }); // 409

        var user = new User { Email = email, DisplayName = request.DisplayName.Trim() };
        user.PasswordHash = _hasher.HashPassword(user, request.Password);
        db.Users.Add(user);

        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Kullanıcı yoksa da şifre yanlışsa da AYNI mesaj: hangi e-postaların kayıtlı olduğu sızmasın
        if (user is null ||
            _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "E-posta veya şifre hatalı." });

        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        var hash = tokens.Hash(request.RefreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (stored is null) return Unauthorized();

        // Daha önce kullanılmış (iptal edilmiş) bir token tekrar geldiyse çalınmış olabilir:
        // güvenlik için kullanıcının tüm oturumlarını kapat
        if (stored.RevokedAt is not null)
        {
            await db.RefreshTokens
                .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
            return Unauthorized();
        }

        if (stored.ExpiresAt <= DateTime.UtcNow) return Unauthorized();

        // Rotation: eski token iptal, yenisi verilir (her refresh token tek kullanımlık)
        stored.RevokedAt = DateTime.UtcNow;
        return Ok(await IssueTokensAsync(stored.User));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest request)
    {
        var hash = tokens.Hash(request.RefreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.RevokedAt == null);
        if (stored is not null)
        {
            stored.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        return NoContent(); // 204
    }

    [Authorize] // Geçerli JWT olmadan 401
    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me()
    {
        // Kimliği istemcinin gönderdiği veriden değil, imzalı token'dan alıyoruz
        var userId = Guid.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return Unauthorized();

        return Ok(new UserResponse(user.Id, user.Email, user.DisplayName));
    }

    private async Task<AuthResponse> IssueTokensAsync(User user)
    {
        var (accessToken, expiresAt) = tokens.CreateAccessToken(user);
        var refreshToken = tokens.CreateRefreshToken();

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokens.Hash(refreshToken),
            ExpiresAt = DateTime.UtcNow.AddDays(config.GetValue("Jwt:RefreshTokenDays", 7)),
        });
        await db.SaveChangesAsync();

        return new AuthResponse(accessToken, expiresAt, refreshToken,
            new UserResponse(user.Id, user.Email, user.DisplayName));
    }
}