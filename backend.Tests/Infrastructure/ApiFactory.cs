using EkipMeet.Api.Data;
using EkipMeet.Api.Services;
using EkipMeet.Api.Services.Push;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace EkipMeet.Api.Tests.Infrastructure;

// Gerçek API'yi bellekte ayağa kaldırır (WebApplicationFactory).
// Veritabanı: Docker varsa Testcontainers ile gerçek PostgreSQL (CI'da böyle çalışır),
// Docker yoksa SQLite in-memory. SQLite'ta PostgreSQL'e özgü iki sorgu (kullanıcı aramasındaki ILike ve
// bildirimlerde jsonb araması) çalışmaz; bu testler o uç noktaları kullanmaz.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private PostgreSqlContainer? _postgres;
    private SqliteConnection? _sqlite;
    private readonly string _uploadsPath = Path.Combine(Path.GetTempPath(), "ekipmeet-tests", Guid.NewGuid().ToString("N"));

    public string DatabaseProvider { get; private set; } = "";

    // Diğer testler birbirini hız sınırına takmasın diye çok yüksek; RateLimitTests kendi küçük değerini verir
    protected virtual int AuthPermitLimit => 100_000;

    public async Task InitializeAsync()
    {
        try
        {
            _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _postgres.StartAsync();
            DatabaseProvider = "PostgreSQL (Testcontainers)";
        }
        catch (Exception)
        {
            // Docker kurulu/çalışır değil: tek bir açık bağlantı yaşadıkça veritabanı da yaşar
            if (_postgres is not null) await _postgres.DisposeAsync();
            _postgres = null;
            _sqlite = new SqliteConnection("DataSource=:memory:");
            _sqlite.Open();
            DatabaseProvider = "SQLite in-memory";
        }

        // Services'e ilk erişim uygulamayı ayağa kaldırır (ConfigureWebHost burada çalışır)
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (_postgres is not null) await db.Database.MigrateAsync(); // Migration'lar da test edilmiş olur
        else await db.Database.EnsureCreatedAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // Sadece testlere özgü değerler; gerçek secret'lar User Secrets'ta kalır
        builder.UseSetting("Jwt:Key", "test-imzalama-anahtari-en-az-32-bayt-olmali-0123456789");
        builder.UseSetting("Push:Enabled", "false");
        builder.UseSetting("FileStorage:LocalPath", _uploadsPath);
        builder.UseSetting("RateLimiting:AuthPermitLimit", AuthPermitLimit.ToString());
        builder.UseSetting("RateLimiting:UploadPermitLimit", "100000");

        builder.ConfigureTestServices(services =>
        {
            // Uygulamanın kendi Npgsql kaydını kaldırıp test veritabanını bağla
            foreach (var d in services.Where(d =>
                         d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                         d.ServiceType == typeof(IDbContextOptionsConfiguration<AppDbContext>)).ToList())
                services.Remove(d);

            services.AddDbContext<AppDbContext>(options =>
            {
                if (_postgres is not null) options.UseNpgsql(_postgres.GetConnectionString());
                else options.UseSqlite(_sqlite!);
            });

            // Arka plan işleri testleri etkilemesin (SQLite tek bağlantıyla eşzamanlı çalışamaz);
            // temizlik mantığı ayrıca doğrudan test edilir
            foreach (var d in services.Where(d =>
                         d.ServiceType == typeof(IHostedService) &&
                         (d.ImplementationType == typeof(RefreshTokenCleanupService) ||
                          d.ImplementationType == typeof(ExpoPushService))).ToList())
                services.Remove(d);
        });
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        if (_postgres is not null) await _postgres.DisposeAsync();
        _sqlite?.Dispose();
        if (Directory.Exists(_uploadsPath)) Directory.Delete(_uploadsPath, recursive: true);
    }
}

// Bütün test sınıfları aynı uygulama + veritabanını paylaşır ve sırayla çalışır
[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
