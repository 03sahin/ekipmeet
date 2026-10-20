import { StatusBar } from 'expo-status-bar';
// useState: component'e state (hafıza) eklemek için kullanılan hook.
import { useState } from 'react';
// Pressable: dokunulabilir alan. Buton yapmak için kullanacağız.
import { Pressable, StyleSheet, Text, View } from 'react-native';

const appName: string = 'EkipMeet';

export default function App() {
  // useState(0): başlangıç değeri 0 olan bir state oluşturur ve iki şey döndürür:
  //   participantCount → state'in şu anki değeri
  //   setParticipantCount → değeri değiştirmek için kullanılan fonksiyon
  // <number>: TypeScript'e bu state'in bir SAYI olacağını söyler.
  const [participantCount, setParticipantCount] = useState<number>(0);

  // Butona basılınca çalışacak fonksiyon. Buna "event handler" denir.
  function handleAddParticipant() {
    // State'i doğrudan değiştirmeyiz (participantCount = 5 YANLIŞ).
    // Her zaman set fonksiyonunu kullanırız. React değişikliği böyle fark eder.
    setParticipantCount(participantCount + 1);
  }

  function handleReset() {
    setParticipantCount(0);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{appName}</Text>
      <Text style={styles.subtitle}>Ekip odaları ve toplantılar tek yerde</Text>

      {/* State'i ekranda gösteriyoruz. Değer değişince bu yazı kendiliğinden güncellenir. */}
      <Text style={styles.counter}>Katılımcı: {participantCount}</Text>

      {/* onPress: dokunulduğunda hangi fonksiyonun çalışacağını belirtir.
          Fonksiyonun adını veriyoruz, parantezle ÇAĞIRMIYORUZ: handleAddParticipant() değil! */}
      <Pressable style={styles.button} onPress={handleAddParticipant}>
        <Text style={styles.buttonText}>Katılımcı ekle</Text>
      </Pressable>

      {/* Koşullu gösterim: sayı 0'dan büyükse "Sıfırla" butonunu göster, değilse hiç gösterme. */}
      {participantCount > 0 && (
        <Pressable style={[styles.button, styles.resetButton]} onPress={handleReset}>
          <Text style={styles.buttonText}>Sıfırla</Text>
        </Pressable>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  counter: {
    fontSize: 20,
    marginTop: 32,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12, // Üst ve alt iç boşluk
    paddingHorizontal: 24, // Sağ ve sol iç boşluk
    borderRadius: 8, // Köşeleri yuvarla
    marginTop: 8,
  },
  resetButton: {
    backgroundColor: '#dc2626', // Kırmızı
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});