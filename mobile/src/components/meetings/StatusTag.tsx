import { StyleSheet, Text } from 'react-native';
import { ParticipantResponse } from '../../types/meeting';

export type TagKind = ParticipantResponse | 'Organizer' | 'Cancelled';

const TAGS: Record<TagKind, { label: string; bg: string; fg: string }> = {
  Accepted: { label: 'Katılıyor', bg: '#dcfce7', fg: '#166534' },
  Declined: { label: 'Katılmıyor', bg: '#fee2e2', fg: '#991b1b' },
  Pending: { label: 'Yanıt bekleniyor', bg: '#fef3c7', fg: '#92400e' },
  Organizer: { label: 'Düzenleyen', bg: '#ffedd5', fg: '#9a3412' },
  Cancelled: { label: 'İptal edildi', bg: '#e5e7eb', fg: '#374151' },
};

// Renkli küçük etiket; label verilirse varsayılan yazının yerine geçer
export default function StatusTag({ kind, label }: { kind: TagKind; label?: string }) {
  const tag = TAGS[kind];
  return <Text style={[styles.tag, { backgroundColor: tag.bg, color: tag.fg }]}>{label ?? tag.label}</Text>;
}

const styles = StyleSheet.create({
  tag: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
});
