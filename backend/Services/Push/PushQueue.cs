using System.Threading.Channels;

namespace EkipMeet.Api.Services.Push;

public record PushJob(IReadOnlyList<Guid> UserIds, string Title, string Body, IReadOnlyDictionary<string, string> Data);

// İstek push gönderimini beklemesin: işler kuyruğa yazılır, ExpoPushService arka planda gönderir.
// Kuyruk doluysa en eski iş düşer; push "en iyi çaba" ile gider, uygulama içi bildirim zaten kaydedildi.
public class PushQueue
{
    private readonly Channel<PushJob> _channel =
        Channel.CreateBounded<PushJob>(new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });

    public void Enqueue(PushJob job) => _channel.Writer.TryWrite(job);

    public IAsyncEnumerable<PushJob> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
