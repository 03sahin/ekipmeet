import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MeetingSummary } from '../../types/meeting';
import { formatClock } from '../../utils/date';
import StatusTag from './StatusTag';
import { MEETING } from './theme';

type Props = { meeting: MeetingSummary; onPress: () => void };

// Takvim/ajanda satırı: solda saat sütunu, renkli şerit, sağda başlık ve durum
export default function MeetingListItem({ meeting, onPress }: Props) {
  const cancelled = meeting.status === 'Cancelled';
  const now = Date.now();
  const live = !cancelled && new Date(meeting.startsAt).getTime() <= now && new Date(meeting.endsAt).getTime() > now;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.timeColumn}>
        <Text style={[styles.start, cancelled && styles.muted]}>{formatClock(new Date(meeting.startsAt))}</Text>
        <Text style={styles.end}>{formatClock(new Date(meeting.endsAt))}</Text>
      </View>

      <View style={[styles.bar, { backgroundColor: cancelled ? '#d1d5db' : live ? '#16a34a' : MEETING.primary }]} />

      <View style={styles.body}>
        <View style={styles.titleLine}>
          {meeting.isInstant && <Ionicons name="flash" size={14} color={MEETING.primary} />}
          <Text style={[styles.title, cancelled && styles.cancelledTitle]} numberOfLines={1}>
            {meeting.title}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {meeting.isOrganizer ? 'Sen düzenliyorsun' : meeting.organizerName} · {meeting.acceptedCount}/
          {meeting.participantCount} katılıyor
        </Text>
        <View style={styles.tags}>
          {cancelled ? (
            <StatusTag kind="Cancelled" />
          ) : live ? (
            <StatusTag kind="Accepted" label="Şu an sürüyor" />
          ) : meeting.isOrganizer ? (
            <StatusTag kind="Organizer" />
          ) : (
            <StatusTag kind={meeting.myResponse} label={meeting.myResponse === 'Pending' ? 'Yanıtın bekleniyor' : undefined} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: MEETING.border,
  },
  pressed: { opacity: 0.7 },
  timeColumn: { width: 52, alignItems: 'flex-start' },
  start: { fontSize: 16, fontWeight: '700', color: '#111827' },
  end: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  muted: { color: '#9ca3af' },
  bar: { width: 4, borderRadius: 2, marginRight: 12 },
  body: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  cancelledTitle: { textDecorationLine: 'line-through', color: '#9ca3af' },
  meta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  tags: { flexDirection: 'row', marginTop: 6 },
});
