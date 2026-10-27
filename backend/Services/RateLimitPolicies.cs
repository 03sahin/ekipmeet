using System.Threading.RateLimiting;
using EkipMeet.Api.Extensions;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace EkipMeet.Api.Services;

// appsettings.json → "RateLimiting". Testler küçük değerlerle 429'u dener.
public class RateLimitOptions
{
    // Giriş/kayıt/token yenileme: IP başına dakikada en fazla bu kadar istek (kaba kuvvet denemelerine karşı)
    public int AuthPermitLimit { get; set; } = 10;

    // Dosya yükleme: kullanıcı başına dakikada en fazla bu kadar dosya (disk doldurma/kötüye kullanıma karşı)
    public int UploadPermitLimit { get; set; } = 20;

    public int WindowSeconds { get; set; } = 60;
}

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Upload = "upload";

    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitOptions>(configuration.GetSection("RateLimiting"));

        return services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = async (context, cancellationToken) =>
            {
                // İstemci ne kadar beklemesi gerektiğini bilsin
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { message = "Çok fazla istek gönderdin. Biraz bekleyip tekrar dene." }, cancellationToken);
            };

            // Giriş yapılmadan önce kullanıcı bilinmez: IP'ye göre sınırla.
            // Not: Ters vekil (reverse proxy) arkasında çalışacaksa ForwardedHeaders ayarlanmalı, yoksa herkes aynı IP görünür.
            limiter.AddPolicy(Auth, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => WindowOptions(context, o => o.AuthPermitLimit)));

            // Yükleme giriş gerektirir: kullanıcı başına sınırla (aynı Wi-Fi'daki herkes birbirini etkilemesin)
            limiter.AddPolicy(Upload, context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.Identity?.IsAuthenticated == true
                    ? context.User.GetUserId().ToString()
                    : context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => WindowOptions(context, o => o.UploadPermitLimit)));
        });
    }

    private static FixedWindowRateLimiterOptions WindowOptions(HttpContext context, Func<RateLimitOptions, int> permitLimit)
    {
        var options = context.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value;
        return new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit(options),
            Window = TimeSpan.FromSeconds(options.WindowSeconds),
            QueueLimit = 0, // Sınır aşılınca bekletme, hemen 429
        };
    }
}
