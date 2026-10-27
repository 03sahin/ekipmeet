using System.Net;
using System.Net.Http.Json;
using EkipMeet.Api.Tests.Infrastructure;

namespace EkipMeet.Api.Tests;

// Kendi uygulama örneğiyle: diğer testlerin istekleri sayaçları etkilemesin
public class RateLimitFactory : ApiFactory
{
    public const int Limit = 3;
    protected override int AuthPermitLimit => Limit;
}

public class RateLimitTests(RateLimitFactory factory) : IClassFixture<RateLimitFactory>
{
    [Fact]
    public async Task Giris_denemeleri_siniri_asinca_429_ve_retry_after()
    {
        var client = factory.CreateClient();
        var body = new { email = "kaba-kuvvet@test.local", password = "yanlis-sifre" };

        for (var i = 0; i < RateLimitFactory.Limit; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", body)).StatusCode);

        var blocked = await client.PostAsJsonAsync("/api/auth/login", body);
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.True(blocked.Headers.Contains("Retry-After"));

        // Aynı sınır kayıt ve yenileme için de geçerli (aynı IP)
        var register = await client.PostAsJsonAsync("/api/auth/register",
            new { email = "yeni@test.local", password = TestApi.Password, displayName = "Yeni" });
        Assert.Equal(HttpStatusCode.TooManyRequests, register.StatusCode);
    }
}
