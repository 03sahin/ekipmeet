using EkipMeet.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EkipMeet.Api.Services;

public class TokenCleanupOptions
{
    public int IntervalHours { get; set; } = 6;

    // İptal edilmiş token'lar hemen silinmez: yeniden kullanılırsa "çalınmış" diye tanıyıp tüm oturumları
    // kapatabilmek için kaydı gerekir. Bu süreden eski iptaller silinir (refresh token ömrüyle aynı varsayılan).
    public int RevokedRetentionDays { get; set; } = 7;
}

// Süresi dolmuş ve uzun süre önce iptal edilmiş refresh token'ları periyodik olarak siler;
// tablo sonsuza dek büyümesin ve eski (işe yaramaz) özetler veritabanında durmasın.
public class RefreshTokenCleanupService(
    IServiceScopeFactory scopeFactory,
    IOptionsMonitor<TokenCleanupOptions> options,
    ILogger<RefreshTokenCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var deleted = await CleanupAsync(db, DateTime.UtcNow, options.CurrentValue, stoppingToken);
                if (deleted > 0) logger.LogInformation("{Count} eski refresh token silindi.", deleted);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogWarning(e, "Refresh token temizliği başarısız; bir sonraki turda tekrar denenecek.");
            }

            await Task.Delay(TimeSpan.FromHours(Math.Max(1, options.CurrentValue.IntervalHours)), stoppingToken);
        }
    }

    // Testlerden de çağrılır
    public static Task<int> CleanupAsync(AppDbContext db, DateTime now, TokenCleanupOptions options, CancellationToken ct = default)
    {
        var revokedBefore = now.AddDays(-options.RevokedRetentionDays);
        return db.RefreshTokens
            .Where(t => t.ExpiresAt <= now || (t.RevokedAt != null && t.RevokedAt <= revokedBefore))
            .ExecuteDeleteAsync(ct);
    }
}
