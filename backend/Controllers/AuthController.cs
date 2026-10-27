using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, IConfiguration config) : ControllerBase
{
    private static readonly PasswordHasher<User> Hasher = new(); // PBKDF2 + salt ile güvenli hash

    // Kullanıcı bulunamadığında da bir hash doğrulaması yapılır; yoksa "yok" yanıtı belirgin şekilde
    // hızlı döner ve süreye bakarak hangi e-postaların kayıtlı olduğu anlaşılabilir (zamanlama saldırısı)
    private static readonly string DummyHash = Hasher.HashPassword(new User(), Guid.NewGuid().ToString());

    [HttpPost("register")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return EmailTaken();

        var user = new User { Email = email, DisplayName = request.DisplayName.Trim() };
        user.PasswordHash = Hasher.HashPassword(user, request.Password);
        db.Users.Add(user);

        try
        {
            return Ok(await IssueTokensAsync(user));
        }
        catch (DbUpdateException)
        {
            // Aynı e-postayla aynı anda iki kayıt: unique index ikincisini reddeder; 500 değil 409 dönsün
            if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == email)) return EmailTaken();
            throw;
        }
    }

    private ConflictObjectResult EmailTaken() => Conflict(new { message = "Bu e-posta zaten kayıtlı." }); // 409

    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Kullanıcı yoksa da şifre yanlışsa da AYNI mesaj ve yaklaşık AYNI süre
        var valid = Hasher.VerifyHashedPassword(user ?? new User(), user?.PasswordHash ?? DummyHash, request.Password)
            != PasswordVerificationResult.Failed;
        if (user is null || !valid)
            return Unauthorized(new { message = "E-posta veya şifre hatalı." });

        return Ok(await IssueTokensAsync(user));
    }

    [HttpPost("refresh")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        var hash = tokens.Hash(request.RefreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (stored is null) return Unauthorized();

        // Daha önce kullanılmış (iptal edilmiş) bir token tekrar geldiyse çalınmış olabilir:
        // güvenlik için kullanıcının tüm oturumlarını kapat
        if (stored.RevokedAt is not null)
        {
            await RevokeAllSessions(stored.UserId);
            return Unauthorized();
        }

        if (stored.ExpiresAt <= DateTime.UtcNow) return Unauthorized();

        // Rotation: eski token iptal, yenisi verilir (her refresh token tek kullanımlık).
        // Koşullu güncelleme: aynı token'la aynı anda iki istek gelirse sadece biri "iptal eden" olur,
        // diğeri 0 satır günceller ve yeniden kullanım sayılır.
        var revoked = await db.RefreshTokens
            .Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
        if (revoked == 0)
        {
            await RevokeAllSessions(stored.UserId);
            return Unauthorized();
        }

        return Ok(await IssueTokensAsync(stored.User));
    }

    // Tüm cihazlardan çıkış: bütün refresh token'lar iptal edilir, push token'lar silinir.
    // Mevcut erişim token'ları (JWT) en fazla Jwt:AccessTokenMinutes süresi daha geçerli kalır.
    [Authorize]
    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll()
    {
        var userId = User.GetUserId(); // Kimin oturumlarının kapanacağı token'dan; istemci başkasını seçemez
        await RevokeAllSessions(userId);
        await db.DeviceTokens.Where(d => d.UserId == userId).ExecuteDeleteAsync(); // Kapanan cihazlara bildirim gitmesin
        return NoContent();
    }

    private Task<int> RevokeAllSessions(Guid userId) =>
        db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));

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
        var user = await db.Users.FindAsync(User.GetUserId());
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