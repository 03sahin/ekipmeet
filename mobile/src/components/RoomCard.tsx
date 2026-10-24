import { Pressable, StyleSheet, Text, View } from 'react-native';

type RoomCardProps = {
  name: string;
  topic: string;
  ownerName: string;
  isOwner: boolean;
  memberCount: number;
  onPress: () => void;
};

export default function RoomCard({ name, topic, ownerName, isOwner, memberCount, onPress }: RoomCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {isOwner && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Senin odan</Text>
          </View>
        )}
      </View>
      {topic ? <Text style={styles.topic} numberOfLines={2}>{topic}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.owner}>Sahibi: {ownerName}</Text>
        <Text style={[styles.count, memberCount > 0 && styles.countActive]}>
          {memberCount > 0 ? `🟢 ${memberCount} kişi içeride` : 'Boş'}
        </Text>
      </View>
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
  name: { fontSize: 18, fontWeight: 'bold', color: '#111827', flex: 1, marginRight: 8 },
  badge: { backgroundColor: '#dbeafe', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  topic: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  owner: { fontSize: 13, color: '#9ca3af' },
  count: { fontSize: 13, color: '#9ca3af' },
  countActive: { color: '#16a34a', fontWeight: '600' },
});