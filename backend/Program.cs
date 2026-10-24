using System.Text;
using System.Text.Json.Serialization;
using EkipMeet.Api.Data;
using EkipMeet.Api.Hubs;
using EkipMeet.Api.Services;
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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication(); // Önce "kimsin?"
app.UseAuthorization();  // Sonra "yetkin var mı?" — sıra önemli
app.MapControllers();
app.MapHub<RoomHub>("/hubs/rooms");
app.Run();