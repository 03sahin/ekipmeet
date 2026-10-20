// import: Başka dosyalardan ya da kütüphanelerden hazır parçaları alır.
// StatusBar: Telefonun en üstündeki saat ve pil çubuğunun rengini ayarlar.
import { StatusBar } from 'expo-status-bar';
// React Native'in temel ekran bileşenleri:
// View = kutu (div gibi), Text = yazı, StyleSheet = stil tanımlama aracı
import { StyleSheet, Text, View } from 'react-native';

// TypeScript: ": string" ile bu değişkenin bir METİN olduğunu belirtiyoruz.
// const = değeri sonradan değişmeyen değişken.
const appName: string = 'EkipMeet';

// Component: Ekranda ne görüneceğini döndüren bir fonksiyon.
// "export default" bu component'i dosyanın ana çıktısı yapar,
// böylece Expo uygulama açılınca bunu gösterir.
export default function App() {
  // return içindeki HTML'e benzeyen yazıma JSX denir.
  return (
    // style={...} ile aşağıda tanımladığımız stilleri bağlıyoruz.
    <View style={styles.container}>
      {/* Süslü parantez { } JSX içinde TypeScript değeri kullanmamızı sağlar */}
      <Text style={styles.title}>{appName}</Text>
      <Text style={styles.subtitle}>Ekip odaları ve toplantılar tek yerde</Text>
      <StatusBar style="auto" />
    </View>
  );
}

// StyleSheet.create: Stilleri bir arada tanımlar.
// CSS'e benzer ama özellik adları camelCase yazılır (background-color → backgroundColor).
const styles = StyleSheet.create({
  container: {
    flex: 1, // Ekranın tamamını kapla
    backgroundColor: '#fff',
    alignItems: 'center', // Yatayda ortala
    justifyContent: 'center', // Dikeyde ortala
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16a34a', // Yeşil
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280', // Gri
    marginTop: 8, // Başlıkla arasına 8 birim boşluk
  },
});