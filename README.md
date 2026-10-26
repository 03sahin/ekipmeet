# EkipMeet

Ekip odaları, sohbet, toplantı planlama ve görüntülü görüşme içeren mobil uygulama.

## Klasör yapısı

- `mobile/` → Expo + React Native + TypeScript uygulaması
- `backend/` → ASP.NET Core Web API (.NET 10) + PostgreSQL

## Teknolojiler

- Mobil: Expo, React Native, TypeScript, React Navigation
- Backend: ASP.NET Core, Entity Framework Core, PostgreSQL, SignalR
- Görüntülü görüşme: WebRTC (react-native-webrtc), sinyalleşme SignalR hub'ı üzerinden

## Mobil: development build (Expo Go artık kullanılmıyor)

> **Not:** Aşama 8'den itibaren uygulama **Expo Go ile açılmaz.** `react-native-webrtc` kendi native
> kodunu içerdiği için Expo Go'da bulunmaz. Uygulama, `expo-dev-client` içeren kendi
> **development build**'imizle çalışır (telefonda/emülatörde "EkipMeet" adıyla kurulu uygulama).

### Gereksinimler (Windows)

- Android SDK: `ANDROID_HOME=C:\Android\Sdk`
- JDK: Android Studio'nun gömülü JDK'sı → `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`
- `GRADLE_USER_HOME=C:\gradle` (kullanıcı klasörü yolunda boşluk/Türkçe karakter olduğu için Gradle oraya yazmasın)
- `mobile/.env.local` içinde bilgisayarın yerel ağ IP'si: `EXPO_PUBLIC_API_URL=http://192.168.x.x:5047`

### İlk kurulum / native paket eklenince (yeniden derleme)

```powershell
cd mobile
npx expo run:android --device emulator-5554   # Emülatöre derler ve kurar
npx expo run:android --device <telefon-seri-no>  # USB'li telefona (adb devices ile görünen seri no)
```

`android/` klasörü `app.json` ve config plugin'lerinden üretilir (git'e girmez); elle düzenlenmez.
Yeni bir native paket eklendiğinde ya da `app.json` değiştiğinde yeniden derlemek gerekir.
Sadece TypeScript kodu değiştiyse yeniden derlemeye gerek yoktur, Metro yeterlidir.

### Günlük geliştirme

```powershell
cd mobile
npx expo start --dev-client   # ya da: npm start
```

Ardından cihazda **EkipMeet** uygulamasını aç; Metro'ya kendisi bağlanır (bağlanmazsa terminalde `a` tuşu
ya da uygulamadaki listeden sunucuyu seç). USB'li telefonda `adb reverse tcp:8081 tcp:8081` Metro bağlantısını kolaylaştırır.

## Dosyalar (sohbet ekleri)

Yüklenen dosyalar `backend/appsettings.json` → `FileStorage:LocalPath` klasörüne (varsayılan `backend/App_Data/uploads`)
rastgele Guid adlarıyla kaydedilir. Bu klasör web kökü dışındadır ve git'e girmez. Dosyalar sadece
`GET /api/attachments/{id}` ile, o sohbetin üyesi olan kullanıcıya verilir. Bulut depolamaya geçmek için
`IFileStorage`'ın yeni bir implementasyonu yazılıp `Program.cs`'te kaydedilmesi yeterlidir.

## Bildirimler ve push

- Uygulama içi bildirimler her zaman çalışır (veritabanı + SignalR).
- Push, Expo Push API üzerinden gider; Android'de Expo, FCM'e iletir. Gerekenler:
  - `mobile/app.json` → `extra.eas.projectId` (`npx eas-cli@latest init` ile eklenir)
  - `mobile/google-services.json` (Firebase konsolundan; git'e girebilir, gizli anahtar değildir)
  - FCM V1 servis hesabı anahtarı **Expo'ya** yüklenir (`npx eas-cli@latest credentials`). Bu JSON gizlidir, **repoya konmaz**.
- Push'u kapatmak için: `Push:Enabled = false`. Expo hesabında push güvenliği açılırsa erişim token'ı User Secrets'a eklenir:
  `dotnet user-secrets set "Push:ExpoAccessToken" "<token>"`

## Görüntülü görüşme ve ICE sunucuları

ICE sunucuları `backend/appsettings.json` → `WebRtc:IceServers` bölümünden okunur ve mobil uygulamaya
`GET /api/calls/ice-servers` ile verilir. Varsayılan olarak sadece ücretsiz STUN sunucuları vardır.

TURN sunucusu eklemek için kullanıcı adı/şifre **koda veya appsettings.json'a yazılmaz**, User Secrets'a eklenir
(dizi indeksi `1`, appsettings'teki STUN girdisinden sonra gelir):

```powershell
cd backend
dotnet user-secrets set "WebRtc:IceServers:1:Urls:0" "turn:turn.ornek.com:3478"
dotnet user-secrets set "WebRtc:IceServers:1:Username" "kullanici"
dotnet user-secrets set "WebRtc:IceServers:1:Credential" "sifre"
```
