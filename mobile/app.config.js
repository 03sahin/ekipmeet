// app.json'daki ayarların üstüne derleme profiline göre eklemeler yapar.
// Expo önce app.json'u okur, sonra bu fonksiyonu çağırır ({ config } = app.json'daki "expo" bölümü).

// eas.json'daki "preview" profili EKIPMEET_ALLOW_HTTP=true verir: o APK yerel ağdaki backend'e http ile bağlanabilir.
// Release derlemelerde Android şifresiz HTTP'yi (cleartext) varsayılan olarak engeller; production'da HTTPS kullanılmalı.
// (Development build'in debug manifest'i zaten HTTP'ye izin verir, burada bir şey gerekmez.)
const allowHttp = process.env.EKIPMEET_ALLOW_HTTP === 'true';

// Release derlemede R8 kodu küçültür. WebRTC'nin Java sınıfları native (JNI) koddan isimleriyle çağrıldığı
// için silinmemeli/yeniden adlandırılmamalı; isteğe bağlı codec'lerin (örn. Dav1dDecoder) eksik sınıfları da
// hata değil, sadece uyarı olmalı.
const proguardRules = `
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
-keep class com.oney.WebRTCModule.** { *; }
`;

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: allowHttp,
          extraProguardRules: proguardRules,
        },
      },
    ],
  ],
});
