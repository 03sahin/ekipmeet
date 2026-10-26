using Microsoft.Extensions.Options;

namespace EkipMeet.Api.Services.Storage;

public class FileStorageOptions
{
    // Göreli yol uygulamanın kök klasörüne göre çözülür. wwwroot (web kökü) dışında olmalı:
    // dosyalar sadece yetki kontrolü yapan GET /api/attachments/{id} ile indirilebilsin.
    public string LocalPath { get; set; } = "App_Data/uploads";
}

public class LocalFileStorage : IFileStorage
{
    private readonly string _root;

    public LocalFileStorage(IOptions<FileStorageOptions> options, IWebHostEnvironment env)
    {
        _root = Path.GetFullPath(Path.Combine(env.ContentRootPath, options.Value.LocalPath));
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(Stream content, CancellationToken cancellationToken)
    {
        // Diskteki ad rastgele Guid: orijinal ad yolda hiç yer almaz, "../../" gibi saldırılar imkânsız
        var key = Guid.NewGuid().ToString("N");
        var path = PathOf(key)!;
        try
        {
            await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await content.CopyToAsync(file, cancellationToken);
        }
        catch
        {
            File.Delete(path); // Yükleme iptal edildi/yarıda kaldı: yarım dosya kalmasın
            throw;
        }
        return key;
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        var path = PathOf(key);
        if (path is null || !File.Exists(path)) return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read));
    }

    public Task DeleteAsync(string key)
    {
        var path = PathOf(key);
        if (path is not null) File.Delete(path); // Dosya yoksa hata vermez
        return Task.CompletedTask;
    }

    // Anahtar sadece 32 haneli Guid olabilir; başka bir şey gelirse (veritabanı bozulsa bile) diske dokunmayız
    private string? PathOf(string key) =>
        Guid.TryParseExact(key, "N", out _) ? Path.Combine(_root, key) : null;
}
