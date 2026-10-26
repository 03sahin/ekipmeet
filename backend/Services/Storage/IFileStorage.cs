namespace EkipMeet.Api.Services.Storage;

// Dosyaların nerede durduğunu controller'lardan gizler. Şimdilik yerel disk (LocalFileStorage);
// buluta geçmek için sadece bu arayüzün yeni bir implementasyonu yazılıp Program.cs'te değiştirilir.
public interface IFileStorage
{
    // Dosyayı kaydeder ve depodaki anahtarını döner (anahtarı depo üretir, istemci asla belirlemez)
    Task<string> SaveAsync(Stream content, CancellationToken cancellationToken);

    // Anahtar geçersizse ya da dosya yoksa null
    Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken);

    // Yoksa sessizce geçer
    Task DeleteAsync(string key);
}
