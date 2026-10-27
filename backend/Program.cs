using System.Text;
using System.Text.Json.Serialization;
using EkipMeet.Api.Data;
using EkipMeet.Api.Hubs;
using EkipMeet.Api.Services;
using EkipMeet.Api.Services.Push;
using EkipMeet.Api.Services.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// Enum'lar JSON'da sayı yerine isim olarak gitsin ("Group", "Owner"): mobilde okunaklı ve sıra değişirse bozulmaz
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();

// Swagger'a "Authorize" butonu ekler; token'ı bir kez girip korumalı endpoint'leri test edebiliriz
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Sadece accessToken değerini yapıştır (başına 'Bearer' yazma).",
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = [],
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Anahtar yoksa uygulama hiç başlamasın: güvensiz çalışmaktansa açıkça hata versin
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key ayarlanmamış. user-secrets ile ekleyin.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // "sub" gibi claim adları olduğu gibi kalsın
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30), // Süre dolunca en fazla 30 sn tolerans
        };

        // WebSocket'te Authorization başlığı gönderilemediği için SignalR token'ı ?access_token= ile yollar.
        // Bunu SADECE /hubs için kabul ediyoruz; normal API'de URL'deki token yok sayılır.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    context.Token = accessToken;
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<TokenService>();
builder.Services.AddSignalR();
builder.Services.AddSingleton<PresenceTracker>(); // Tek örnek: tüm bağlantılar aynı listeyi görür
builder.Services.AddSingleton<ChatNotifier>();
builder.Services.AddSingleton<MeetingNotifier>();
builder.Services.AddSingleton<CallTracker>(); // Görüşmedekiler de PresenceTracker gibi tek listede
builder.Services.AddSingleton<CallNotifier>();
// ICE (STUN/TURN) sunucuları yapılandırmadan; TURN şifresi User Secrets'tan gelir
builder.Services.Configure<WebRtcOptions>(builder.Configuration.GetSection("WebRtc"));

// Dosyalar: şimdilik yerel disk. Buluta geçince sadece bu satır değişir (IFileStorage'ın başka implementasyonu).
builder.Services.Configure<FileStorageOptions>(builder.Configuration.GetSection("FileStorage"));
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();

// Bildirimler ve push (Expo Push API). Push:Enabled false ise push sessizce atlanır.
builder.Services.AddSingleton<ConversationPresence>();
builder.Services.AddScoped<NotificationService>();
builder.Services.Configure<PushOptions>(builder.Configuration.GetSection("Push"));
builder.Services.AddSingleton<PushQueue>();
builder.Services.AddHttpClient(ExpoPushService.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHostedService<ExpoPushService>();

// Güvenlik: hız sınırı (giriş/kayıt/yenileme ve dosya yükleme) ve eski refresh token temizliği
builder.Services.AddAppRateLimiting(builder.Configuration);
builder.Services.Configure<TokenCleanupOptions>(builder.Configuration.GetSection("TokenCleanup"));
builder.Services.AddHostedService<RefreshTokenCleanupService>();

// Beklenmeyen hatalar RFC 7807 ProblemDetails olarak döner; stack trace ve iç ayrıntı istemciye gitmez
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions.Remove("exception"); // Geliştirme ortamında bile istisna ayrıntısı eklenmesin
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier; // Logda bulmak için
    });

// Mobil uygulama tarayıcı değildir, CORS'a ihtiyaç duymaz. Bir web istemcisi eklenirse adresi
// "Cors:AllowedOrigins" ile verilir; listede olmayan kaynaklardan tarayıcı istekleri reddedilir.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

if (builder.Environment.IsProduction())
    builder.Services.AddHsts(options => options.MaxAge = TimeSpan.FromDays(180));

var app = builder.Build();

app.UseExceptionHandler(); // İşlenmeyen hata → 500 ProblemDetails (ayrıntısız)
app.UseStatusCodePages();  // Gövdesiz 4xx/5xx yanıtlar da ProblemDetails olsun

// Güvenlik başlıkları: tarayıcı içerik türünü tahmin etmesin, sayfa çerçeveye alınmasın, adres sızmasın
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers.XContentTypeOptions = "nosniff";
    headers.XFrameOptions = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    await next();
});

if (app.Environment.IsProduction())
{
    app.UseHsts();             // Tarayıcılar bu alan adına bir daha sadece HTTPS ile gelsin
    app.UseHttpsRedirection(); // Production'da http istekleri https'e yönlendirilir
}
else if (app.Environment.IsDevelopment())
{
    // Swagger sadece geliştirmede: production'da API'nin haritası dışarıya açılmaz
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication(); // Önce "kimsin?"
app.UseAuthorization();  // Sonra "yetkin var mı?" — sıra önemli
app.UseRateLimiter();    // Kimlikten sonra: yükleme sınırı kullanıcıya göre ayrılır
app.MapControllers();
app.MapHub<RoomHub>("/hubs/rooms");
app.Run();

// Entegrasyon testlerindeki WebApplicationFactory<Program> için
public partial class Program;