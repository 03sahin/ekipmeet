import { StyleSheet, Text } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { ParticipantResponse } from '../../types/meeting';

export type TagKind = ParticipantResponse | 'Organizer' | 'Cancelled';

const LABELS: Record<TagKind, string> = {
  Accepted: 'Katılıyor',
  Declined: 'Katılmıyor',
  Pending: 'Yanıt bekleniyor',
  Organizer: 'Düzenleyen',
  Cancelled: 'İptal edildi',
};

function tagColors(c: ThemeColors, kind: TagKind): { bg: string; fg: string } {
  switch (kind) {
    case 'Accepted':
      return { bg: c.chats.soft, fg: c.chats.onSoft };
    case 'Declined':
      return { bg: c.dangerSoft, fg: c.onDangerSoft };
    case 'Pending':
      return { bg: c.warningSoft, fg: c.onWarningSoft };
    case 'Organizer':
      return { bg: c.meetings.border, fg: c.meetings.onSoft };
    case 'Cancelled':
      return { bg: c.surfaceMuted, fg: c.textSecondary };
  }
}

// Renkli küçük etiket; label verilirse varsayılan yazının yerine geçer
export default function StatusTag({ kind, label }: { kind: TagKind; label?: string }) {
  const { colors } = useTheme();
  const tag = tagColors(colors, kind);
  return <Text style={[styles.tag, { backgroundColor: tag.bg, color: tag.fg }]}>{label ?? LABELS[kind]}</Text>;
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
