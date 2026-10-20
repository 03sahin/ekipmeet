import { Pressable, StyleSheet, Text, View } from 'react-native';

type RoomCardProps = {
  name: string;
  topic: string;
  memberCount: number;
  onPress: () => void; // Karta dokunulunca çalışacak fonksiyon (dışarıdan gelir)
};

export default function RoomCard({ name, topic, memberCount, onPress }: RoomCardProps) {
  const isActive = memberCount > 0; // Türetilmiş değer

  return (
    // pressed: dokunulurken true olur, hafif soluklaşma efekti veriyoruz
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeIdle]}>
          <Text style={styles.badgeText}>{isActive ? 'Aktif' : 'Boş'}</Text>
        </View>
      </View>
      <Text style={styles.topic}>{topic}</Text>
      <Text style={styles.members}>{memberCount} kişi içeride</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pressed: { opacity: 0.6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeActive: { backgroundColor: '#16a34a' },
  badgeIdle: { backgroundColor: '#9ca3af' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  topic: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  members: { fontSize: 13, color: '#2563eb', marginTop: 8 },
});