using System.Net.Http.Headers;
using System.Net.Http.Json;
using EkipMeet.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EkipMeet.Api.Services.Push;

public class PushOptions
{
    // false ise push hiç gönderilmez; uygulama içi bildirimler çalışmaya devam eder
    public bool Enabled { get; set; }

    // İsteğe bağlı. Expo hesabında "push güvenliği" açıksa gerekir; koda değil User Secrets'a yazılır.
    public string? ExpoAccessToken { get; set; }
}

// Kuyruktaki işleri Expo Push API'sine gönderir: https://docs.expo.dev/push-notifications/sending-notifications/
// Expo, Android için FCM'e kendisi iletir; backend'in Firebase anahtarını bilmesine gerek yoktur.
public class ExpoPushService(
    PushQueue queue,
    IServiceScopeFactory scopeFactory,
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<PushOptions> options,
    ILogger<ExpoPushService> logger) : BackgroundService
{
    public const string HttpClientName = "expo-push";
    private const int BatchSize = 100; // Expo tek istekte en fazla 100 mesaj kabul eder

    private sealed record ExpoMessage(
        string To,
        string Title,
        string Body,
        IReadOnlyDictionary<string, string> Data,
        string Sound = "default",
        string Priority = "high",
        string ChannelId = "default"); // Mobilde oluşturulan Android bildirim kanalı

    private sealed record ExpoTicketDetails(string? Error);
    private sealed record ExpoTicket(string Status, string? Message, ExpoTicketDetails? Details);
    private sealed record ExpoResponse(List<ExpoTicket>? Data);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.ReadAllAsync(stoppingToken))
        {
            if (!options.CurrentValue.Enabled) continue; // Yapılandırılmamış: sessizce atla
            try
            {
                await SendAsync(job, stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                // Push gitmezse uygulama bozulmasın; sadece logla
                logger.LogWarning(e, "Push bildirimi gönderilemedi.");
            }
        }
    }

    private async Task SendAsync(PushJob job, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tokens = await db.DeviceTokens.AsNoTracking()
            .Where(d => job.UserIds.Contains(d.UserId))
            .Select(d => d.Token)
            .ToListAsync(cancellationToken);
        if (tokens.Count == 0) return;

        var client = httpClientFactory.CreateClient(HttpClientName);
        var invalid = new List<string>();

        foreach (var batch in tokens.Chunk(BatchSize))
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://exp.host/--/api/v2/push/send")
            {
                Content = JsonContent.Create(batch.Select(t => new ExpoMessage(t, job.Title, job.Body, job.Data))),
            };
            if (options.CurrentValue.ExpoAccessToken is { Length: > 0 } accessToken)
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Expo push isteği başarısız: {Status}", (int)response.StatusCode);
                continue;
            }

            // Yanıttaki biletler gönderilen sırayla gelir
            var result = await response.Content.ReadFromJsonAsync<ExpoResponse>(cancellationToken);
            var tickets = result?.Data ?? [];
            for (var i = 0; i < tickets.Count && i < batch.Length; i++)
            {
                if (tickets[i].Status != "error") continue;
                if (tickets[i].Details?.Error == "DeviceNotRegistered") invalid.Add(batch[i]); // Uygulama silinmiş vb.
                else logger.LogWarning("Expo push hatası: {Message}", tickets[i].Message);
            }
        }

        // Geçersiz token'lar bir daha denenmesin
        if (invalid.Count > 0)
            await db.DeviceTokens.Where(d => invalid.Contains(d.Token)).ExecuteDeleteAsync(cancellationToken);
    }
}
