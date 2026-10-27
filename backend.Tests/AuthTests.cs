using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EkipMeet.Api.Data;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using EkipMeet.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EkipMeet.Api.Tests;

[Collection(ApiCollection.Name)]
public class AuthTests(ApiFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    private Task<HttpResponseMessage> Refresh(string refreshToken) =>
        _client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });

    [Fact]
    public async Task Kayit_token_dondurur_ve_ayni_eposta_ikinci_kez_kaydedilemez()
    {
        var email = $"kayit-{Guid.NewGuid():N}@test.local";
        var body = new { email, password = TestApi.Password, displayName = "Kayıt" };

        var first = await _client.PostAsJsonAsync("/api/auth/register", body);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var auth = await first.ReadAsync<AuthResult>();
        Assert.False(string.IsNullOrEmpty(auth.AccessToken));
        Assert.False(string.IsNullOrEmpty(auth.RefreshToken));

        var second = await _client.PostAsJsonAsync("/api/auth/register", body with { displayName = "Başka" });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Giris_dogru_sifreyle_basarili_yanlis_sifre_ve_olmayan_eposta_ayni_401()
    {
        var auth = await TestApi.RegisterAsync(_client, "Giris");

        var ok = await _client.PostAsJsonAsync("/api/auth/login", new { email = auth.User.Email, password = TestApi.Password });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var wrongPassword = await _client.PostAsJsonAsync("/api/auth/login", new { email = auth.User.Email, password = "yanlis-sifre" });
        var unknownEmail = await _client.PostAsJsonAsync("/api/auth/login", new { email = "yok@test.local", password = "yanlis-sifre" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        // Hangi e-postaların kayıtlı olduğu yanıttan anlaşılmamalı
        Assert.Equal(await wrongPassword.Content.ReadAsStringAsync(), await unknownEmail.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Refresh_rotation_yeni_token_verir_ve_eskisi_artik_gecmez()
    {
        var auth = await TestApi.RegisterAsync(_client, "Rotation");

        var refreshed = await Refresh(auth.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var next = await refreshed.ReadAsync<AuthResult>();
        Assert.NotEqual(auth.RefreshToken, next.RefreshToken);

        // Yeni token çalışır
        var again = await Refresh(next.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    [Fact]
    public async Task Kullanilmis_refresh_token_tekrar_gelirse_tum_oturumlar_kapanir()
    {
        var auth = await TestApi.RegisterAsync(_client, "Reuse");
        var stolen = auth.RefreshToken;

        var legit = await (await Refresh(stolen)).ReadAsync<AuthResult>(); // Gerçek kullanıcı yeniledi

        // Saldırgan eski (kullanılmış) token'ı dener → reddedilir...
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(stolen)).StatusCode);
        // ...ve güvenlik için gerçek kullanıcının yeni token'ı da iptal edilmiştir
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(legit.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task LogoutAll_tum_refresh_tokenlari_iptal_eder()
    {
        var auth = await TestApi.RegisterAsync(_client, "LogoutAll");
        var otherDevice = await (await _client.PostAsJsonAsync("/api/auth/login",
            new { email = auth.User.Email, password = TestApi.Password })).ReadAsync<AuthResult>();

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout-all");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(request)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(auth.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(otherDevice.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task Tokensiz_korumali_istek_401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsync("/api/auth/logout-all", null)).StatusCode);
    }

    [Fact]
    public async Task Temizlik_suresi_dolmus_ve_eski_iptal_edilmis_tokenlari_siler_yenileri_birakir()
    {
        var auth = await TestApi.RegisterAsync(_client, "Cleanup");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;

        RefreshToken Token(DateTime expiresAt, DateTime? revokedAt) => new()
        {
            UserId = auth.User.Id, TokenHash = Guid.NewGuid().ToString("N"), ExpiresAt = expiresAt, RevokedAt = revokedAt,
        };
        var expired = Token(now.AddMinutes(-1), null);
        var oldRevoked = Token(now.AddDays(5), now.AddDays(-10));
        var recentRevoked = Token(now.AddDays(5), now.AddHours(-1)); // Yeniden kullanım tespiti için kalmalı
        var active = Token(now.AddDays(5), null);
        db.RefreshTokens.AddRange(expired, oldRevoked, recentRevoked, active);
        await db.SaveChangesAsync();

        await RefreshTokenCleanupService.CleanupAsync(db, now, new TokenCleanupOptions { RevokedRetentionDays = 7 });

        var remaining = await db.RefreshTokens.AsNoTracking().Where(t => t.UserId == auth.User.Id).Select(t => t.Id).ToListAsync();
        Assert.DoesNotContain(expired.Id, remaining);
        Assert.DoesNotContain(oldRevoked.Id, remaining);
        Assert.Contains(recentRevoked.Id, remaining);
        Assert.Contains(active.Id, remaining);
    }
}
