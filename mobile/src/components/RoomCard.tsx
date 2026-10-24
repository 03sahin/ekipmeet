import { Pressable, StyleSheet, Text, View } from 'react-native';

// Her oda kalıcı bir renk alsın diye id'den seçiyoruz (liste yenilense de renk değişmez)
const ACCENTS = ['#2563eb', '#7c3aed', '#0891b2', '#db2777', '#ea580c', '#4f46e5'];

type RoomCardProps = {
  id: number;
  name: string;
  topic: string;
  ownerName: string;
  isOwner: boolean;
  memberCount: number;
  onPress: () => void;
};

// Izgaradaki hızlı erişim kutucuğu: renkli üst şerit, ad ve canlı kişi sayısı öne çıkar
export default function RoomCard({ id, name, topic, ownerName, isOwner, memberCount, onPress }: RoomCardProps) {
  const accent = ACCENTS[id % ACCENTS.length];
  const live = memberCount > 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.band, { backgroundColor: accent }]}>
        <Text style={styles.initial}>{name.trim()[0]?.toLocaleUpperCase('tr-TR') ?? '#'}</Text>
        {isOwner && <Text style={styles.ownerBadge}>Senin</Text>}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.topic} numberOfLines={2}>{topic || `Sahibi: ${ownerName}`}</Text>

        <View style={[styles.countPill, live && styles.countPillLive]}>
          <View style={[styles.dot, live && styles.dotLive]} />
          <Text style={[styles.countText, live && styles.countTextLive]}>
            {live ? `${memberCount} kişi içeride` : 'Boş'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  band: { height: 64, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  initial: { color: '#fff', fontSize: 28, fontWeight: '800' },
  ownerBadge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  body: { padding: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  topic: { fontSize: 13, color: '#6b7280', marginTop: 4, minHeight: 34 }, // Kartlar aynı boyda dursun
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  countPillLive: { backgroundColor: '#dcfce7' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af' },
  dotLive: { backgroundColor: '#16a34a' },
  countText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  countTextLive: { color: '#166534' },
});
