# EkipMeet

[![CI](https://github.com/03sahin/ekipmeet/actions/workflows/ci.yml/badge.svg)](https://github.com/03sahin/ekipmeet/actions/workflows/ci.yml)

Ekip odaları, birebir/grup sohbet (dosya ekleriyle), toplantı planlama, görüntülü görüşme ve
bildirimler içeren mobil uygulama.

## Mimari (kısa özet)

```
mobile/  (Expo + React Native)  ── REST (JWT) ──►  backend/  (ASP.NET Core .NET 10)  ──►  PostgreSQL
            │                    ◄─ SignalR ──┘        │                                    (EF Core)
            └──── WebRTC (cihazdan cihaza görüntü/ses) │──► Expo Push API ──► FCM ──► cihaz
                                                       └──► IFileStorage (yerel disk: App_Data/uploads)
```

- **Kimlik:** Kısa ömürlü JWT erişim token'ı + tek kullanımlık refresh token (rotation). Yeniden kullanılan
  refresh token "çalınmış" sayılır ve kullanıcının tüm oturumları kapanır. Kullanıcı kimliği her zaman token'dan okunur.
- **Gerçek zamanlı:** Tek SignalR hub'ı (`/hubs/rooms`): oda doluluğu ve oda sohbeti, sohbet/toplantı/bildirim
  olayları (`user-{id}` kişisel grupları) ve görüntülü görüşme sinyalleşmesi.
- **Görüntülü görüşme:** Mesh WebRTC (görüşme başına en fazla 6 kişi). ICE sunucuları yapılandırmadan gelir.
- **Yetki:** Her endpoint ve hub metodu giriş ister. Kaynaklara id ile erişimde sahiplik/üyelik kontrol edilir;
  üye olmayana kaynağın varlığı bile sızmasın diye 404 döner.
- **Güvenlik:** Giriş/kayıt/yenileme ve dosya yüklemede hız sınırı (429), ProblemDetails hata yanıtları,
  güvenlik başlıkları, production'da HTTPS + HSTS, Swagger sadece geliştirmede.

Klasörler: `mobile/` (uygulama), `backend/` (Web API), `backend.Tests/` (xUnit entegrasyon testleri),
`.github/workflows/ci.yml` (CI).

## Kurulum

### Gereksinimler

- .NET 10 SDK, PostgreSQL, Node.js 24
- Android: Android SDK (`ANDROID_HOME=C:\Android\Sdk`), Android Studio'nun JDK'sı
  (`JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`)
- Windows: `GRADLE_USER_HOME=C:\gradle` (kullanıcı klasörü yolunda boşluk/Türkçe karakter varsa Gradle oraya yazmasın)
  ve uzun yol desteği açık olmalı (`LongPathsEnabled = 1`)
- İsteğe bağlı: Docker (testler gerçek PostgreSQL'de koşar; yoksa SQLite in-memory kullanılır)

### Backend

Gizli bilgiler koda ve `appsettings.json`'a yazılmaz; User Secrets'a eklenir:

```powershell
cd backend
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=ekipmeet;Username=postgres;Password=<sifre>"
dotnet user-secrets set "Jwt:Key" "<en az 32 karakterlik rastgele bir anahtar>"
dotnet ef database update          # Migration'ları uygula
dotnet run --launch-profile http   # http://0.0.0.0:5047, Swagger: http://localhost:5047/swagger
```

### Mobil

`mobile/.env.local` içine bilgisayarın yerel ağ IP'sini yaz: `EXPO_PUBLIC_API_URL=http://192.168.x.x:5047`

> **Expo Go kullanılmıyor.** `react-native-webrtc` kendi native kodunu içerdiği için uygulama, `expo-dev-client`
> içeren kendi **development build**'imizle çalışır (cihazda "EkipMeet" adıyla kurulu uygulama).

```powershell
cd mobile
npm install
npx expo run:android --device emulator-5554      # Emülatöre derler ve kurar
npx expo run:android --device <telefon-seri-no>  # USB'li telefona (adb devices ile görünen seri no)
```

`android/` klasörü `app.json` ve config plugin'lerinden üretilir (git'e girmez, elle düzenlenmez). Yeni bir native paket
eklendiğinde ya da `app.json` değiştiğinde yeniden derlemek gerekir; sadece TypeScript değiştiyse Metro yeterlidir.

## Çalıştırma

```powershell
cd mobile
npx expo start --dev-client   # ya da: npm start
```

Cihazda **EkipMeet** uygulamasını aç; Metro'ya kendisi bağlanır. USB'li telefonda bağlantıyı kolaylaştırmak için:
`adb reverse tcp:8081 tcp:8081` ve `adb reverse tcp:5047 tcp:5047`.

## Yayın: telefona kurulabilen APK (preview)

`eas.json`'daki `preview` profili Metro'ya ihtiyaç duymayan, kendi içinde JS paketi olan bir **APK** üretir:

```powershell
cd mobile
npx eas-cli@latest build -p android --profile preview
```

- Backend adresi derleme sırasında gömülür: `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`
  (bilgisayarın yerel ağ IP'si değişirse güncellenip yeniden derlenmelidir).
- **HTTP (cleartext) sadece preview'da açık.** Release derlemelerde Android şifresiz HTTP'yi engeller; preview profili
  `EKIPMEET_ALLOW_HTTP=true` verir ve `app.config.js` bu durumda `expo-build-properties` ile `usesCleartextTraffic`'i açar.
  Development build'in debug manifest'i HTTP'ye zaten izin verir.
- **Production için HTTPS zorunludur:** backend gerçek bir alan adında, geçerli bir TLS sertifikasıyla yayınlanmalı,
  `EXPO_PUBLIC_API_URL` `https://...` olmalı ve production profilinde HTTP izni verilmemelidir.
- Sürüm `app.json`'dan okunur (`appVersionSource: local`): `version` 1.0.0, `android.versionCode` 1. Her yeni APK'da
  versionCode artırılmalıdır, yoksa Android eski sürümün üzerine kurmaz.

### Backend'i APK ile kullanmak için başlatma

```powershell
cd backend
dotnet run -c Release --launch-profile http   # 0.0.0.0:5047, yerel ağdaki telefon erişebilir
```

Ortam `Development` kalır: User Secrets (bağlantı dizesi, JWT anahtarı) sadece Development'ta okunur ve
`Production` HTTPS'e yönlendirdiği için http ile gelen telefon bağlanamaz. Gerçek yayında secret'lar ortam
değişkenlerinden verilip `ASPNETCORE_ENVIRONMENT=Production` ve HTTPS kullanılır.

Windows Güvenlik Duvarı 5047'ye gelen bağlantıyı engelliyorsa (yönetici PowerShell):

```powershell
New-NetFirewallRule -DisplayName "EkipMeet API 5047 (yerel ag)" -Direction Inbound -Protocol TCP -LocalPort 5047 -Action Allow -Profile Private,Public -RemoteAddress LocalSubnet
```

## Test ve kalite kontrolleri

```powershell
dotnet test ekipmeet.slnx     # Backend entegrasyon testleri

cd mobile
npx tsc --noEmit              # Tip kontrolü
npm run lint                  # ESLint (eslint-config-expo)
```

Testler `WebApplicationFactory` ile API'yi bellekte çalıştırır. Docker varsa Testcontainers ile gerçek PostgreSQL
kullanılır (GitHub Actions'ta böyle); yoksa SQLite in-memory'ye düşülür. Kapsanan senaryolar: kayıt/giriş, refresh
rotation ve yeniden kullanım tespiti, logout-all, oda sahipliği (403), sohbet üyeliği ve dosya eki yetkisi (404),
sahte uzantılı ve 10 MB üstü dosyaların reddi, toplantı düzenleme yetkisi, hız sınırı (429), güvenlik başlıkları.

GitHub Actions her push ve PR'da backend'i derleyip test eder, mobilde `npm ci` + `tsc` + ESLint çalıştırır.

## Yapılandırma

| Ayar (`backend/appsettings.json`) | Açıklama |
| --- | --- |
| `RateLimiting:AuthPermitLimit` | Giriş/kayıt/yenileme: IP başına dakikadaki istek sınırı (varsayılan 10) |
| `RateLimiting:UploadPermitLimit` | Dosya yükleme: kullanıcı başına dakikadaki sınır (varsayılan 20) |
| `TokenCleanup:IntervalHours` | Eski refresh token temizliğinin sıklığı |
| `Cors:AllowedOrigins` | Web istemcisi eklenirse izinli kaynaklar (mobil uygulama CORS'a ihtiyaç duymaz) |
| `FileStorage:LocalPath` | Yüklenen dosyaların klasörü (web kökü dışında, git'e girmez) |
| `Push:Enabled` | `false` ise push gönderilmez; uygulama içi bildirimler çalışmaya devam eder |
| `WebRtc:IceServers` | STUN/TURN sunucuları |

### Dosyalar (sohbet ekleri)

Dosyalar rastgele Guid adlarıyla saklanır; orijinal ad hiçbir zaman dosya yolu olarak kullanılmaz. Tür, uzantı + dosya
imzasına (magic bytes) göre belirlenir. En fazla 10 MB; izinli türler: jpg, png, webp, heic, pdf, docx, xlsx, pptx,
txt, zip. Bulut depolamaya geçmek için `IFileStorage`'ın yeni bir implementasyonu yazılıp `Program.cs`'te kaydedilir.

### Bildirimler ve push

- Push, Expo Push API üzerinden gider; Android'de Expo, FCM'e iletir. Gerekenler:
  - `mobile/app.json` → `extra.eas.projectId` (`npx eas-cli@latest init`)
  - `mobile/google-services.json` (Firebase konsolundan; gizli anahtar değildir)
  - FCM V1 servis hesabı anahtarı **Expo'ya** yüklenir (`npx eas-cli@latest credentials`). Bu JSON gizlidir, **repoya konmaz**.
- Expo hesabında push güvenliği açılırsa: `dotnet user-secrets set "Push:ExpoAccessToken" "<token>"`
- Toplantı hatırlatıcıları (başlangıçtan 10 dk önce) cihazda yerel bildirim olarak kurulur. Android 14+'te
  "Alarm ve hatırlatıcılar" izni istenir; Xiaomi gibi cihazlarda uygulama için pil kısıtlaması kapatılmalıdır.

### Görüntülü görüşme ve TURN

Varsayılan olarak sadece ücretsiz STUN sunucuları vardır. TURN bilgileri User Secrets'a eklenir
(dizi indeksi `1`, appsettings'teki STUN girdisinden sonra gelir):

```powershell
cd backend
dotnet user-secrets set "WebRtc:IceServers:1:Urls:0" "turn:turn.ornek.com:3478"
dotnet user-secrets set "WebRtc:IceServers:1:Username" "kullanici"
dotnet user-secrets set "WebRtc:IceServers:1:Credential" "sifre"
```

## Bilinen sınırlar

- Hız sınırı istemci IP'sine göredir. Ters vekil (reverse proxy) arkasında çalıştırılacaksa `ForwardedHeaders`
  ayarlanmalıdır, yoksa tüm istekler aynı IP'den geliyor görünür.
- `logout-all` sonrası mevcut erişim token'ları (JWT) en fazla `Jwt:AccessTokenMinutes` (15 dk) daha geçerlidir.
- SignalR hub mesajlarında (oda sohbeti) ayrıca hız sınırı yoktur.
