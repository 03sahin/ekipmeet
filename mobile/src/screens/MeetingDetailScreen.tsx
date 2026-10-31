import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '../api/errors';
import {
  addParticipant,
  cancelMeeting,
  getMeeting,
  removeParticipant,
  respondToMeeting,
} from '../api/meetings';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import StatusTag from '../components/meetings/StatusTag';

import UserSearch from '../components/UserSearch';
import { RootStackParamList } from '../navigation/types';
import { onHubEvent } from '../realtime/roomHub';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { meetingCallKey } from '../types/call';
import { UserSummary } from '../types/chat';
import { MeetingDetail, MeetingParticipant } from '../types/meeting';
import { formatDuration, formatLongDate, formatTimeRange } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'MeetingDetail'>;

const JOIN_EARLY_MS = 10 * 60 * 1000; // "Toplantıya katıl" başlangıçtan 10 dk önce açılır

export default function MeetingDetailScreen({ route, navigation }: Props) {
  const { meetingId } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    getMeeting(meetingId)
      .then((m) => {
        setMeeting(m);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [meetingId]);

  // Düzenleme ekranından dönünce de güncel olsun
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Canlı: başkası yanıt verdi, düzenleyen saati değiştirdi/iptal etti, ben çıkarıldım
  useEffect(() => {
    const reloadIfMine = (id: string) => {
      if (id === meetingId) load();
    };
    const offs = [
      onHubEvent('MeetingChanged', reloadIfMine),
      onHubEvent('MeetingCancelled', reloadIfMine),
      onHubEvent('MeetingInvited', reloadIfMine),
      onHubEvent('MeetingRemoved', (id: string) => {
        if (id !== meetingId) return;
        Alert.alert('Toplantıdan çıkarıldın', 'Düzenleyen seni bu toplantının katılımcılarından çıkardı.');
        if (navigation.canGoBack()) navigation.goBack();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [meetingId, load, navigation]);

  // "Katıl" butonunun aktifliği zamana bağlı: ekran açık dururken kendiliğinden değişsin
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Tüm işlemler aynı kalıp: çalıştır, dönen güncel detayı göster, hata varsa uyar
  async function run(action: () => Promise<MeetingDetail>, failTitle: string) {
    if (busy) return;
    setBusy(true);
    try {
      setMeeting(await action());
    } catch (e) {
      Alert.alert(failTitle, getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel() {
    Alert.alert('Toplantıyı iptal et', 'Tüm katılımcılara iptal bildirimi gidecek. Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'İptal et', style: 'destructive', onPress: () => run(() => cancelMeeting(meetingId), 'İptal edilemedi') },
    ]);
  }

  function confirmRemove(p: MeetingParticipant) {
    Alert.alert('Katılımcıyı çıkar', `${p.displayName} toplantıdan çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: () => run(() => removeParticipant(meetingId, p.userId), 'Çıkarılamadı'),
      },
    ]);
  }

  function handleAdd(u: UserSummary) {
    run(() => addParticipant(meetingId, u.id), 'Eklenemedi').then(() => setAdding(false));
  }

  if (error && !meeting) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.meetings.text} />
      </View>
    );
  }

  const start = new Date(meeting.startsAt);
  const startMs = start.getTime();
  const endMs = new Date(meeting.endsAt).getTime();
  const cancelled = meeting.status === 'Cancelled';
  const ended = endMs <= now;
  const live = !cancelled && startMs <= now && !ended;
  const canJoin = !cancelled && !ended && now >= startMs - JOIN_EARLY_MS;
  const editable = meeting.isOrganizer && !cancelled && !ended; // Asıl kontrol backend'de; bu arayüz kolaylığı
  const canRespond = !meeting.isOrganizer && !cancelled && !ended;

  const joinHint = cancelled
    ? 'Toplantı iptal edildi.'
    : ended
      ? 'Toplantı sona erdi.'
      : canJoin
        ? live
          ? 'Toplantı şu an sürüyor.'
          : 'Toplantı birazdan başlıyor.'
        : 'Başlangıçtan 10 dakika önce katılabilirsin.';

  const accepted = meeting.participants.filter((p) => p.response === 'Accepted').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {cancelled && (
        <View style={styles.cancelBanner}>
          <Ionicons name="close-circle" size={20} color={colors.onDangerSoft} />
          <Text style={styles.cancelText}>Bu toplantı iptal edildi</Text>
        </View>
      )}

      {/* Takvim yaprağı görünümünde tarih kartı */}
      <View style={styles.dateCard}>
        <View style={[styles.dateLeaf, cancelled && styles.dateLeafCancelled]}>
          <Text style={styles.leafMonth}>{start.toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase()}</Text>
          <Text style={styles.leafDay}>{start.getDate()}</Text>
        </View>
        <View style={styles.dateInfo}>
          <View style={styles.titleLine}>
            {meeting.isInstant && <Ionicons name="flash" size={18} color={colors.meetings.text} />}
            <Text style={[styles.title, cancelled && styles.titleCancelled]}>{meeting.title}</Text>
          </View>
          <Text style={styles.dateText}>{formatLongDate(start)}</Text>
          <Text style={styles.dateText}>
            {formatTimeRange(meeting.startsAt, meeting.endsAt)} · {formatDuration(meeting.durationMinutes)}
          </Text>
          <Text style={styles.organizer}>
            Düzenleyen: {meeting.isOrganizer ? 'Sen' : meeting.organizerName}
          </Text>
        </View>
      </View>

      {meeting.description ? <Text style={styles.description}>{meeting.description}</Text> : null}

      {/* Toplantıya katıl: zaman ve yetki kontrolü backend'de de (JoinCall) yapılır */}
      <Pressable
        style={[styles.joinButton, !canJoin && styles.joinDisabled]}
        disabled={!canJoin}
        onPress={() => navigation.navigate('Call', { callKey: meetingCallKey(meetingId), title: meeting.title })}
      >
        <Ionicons name="videocam" size={20} color="#fff" />
        <Text style={styles.joinText}>Toplantıya katıl</Text>
      </Pressable>
      <Text style={styles.joinHint}>{joinHint}</Text>

      {canRespond && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Katılacak mısın?</Text>
          <View style={styles.respondRow}>
            {(['Accepted', 'Declined'] as const).map((r) => {
              const selected = meeting.myResponse === r;
              const color = r === 'Accepted' ? colors.chats.text : colors.danger; // Kenarlık ve yazı
              const fill = r === 'Accepted' ? colors.chats.solid : colors.dangerSolid; // Seçiliyken zemin
              return (
                <Pressable
                  key={r}
                  style={[styles.respondButton, { borderColor: selected ? fill : color }, selected && { backgroundColor: fill }]}
                  disabled={busy || selected}
                  onPress={() => run(() => respondToMeeting(meetingId, r), 'Yanıt gönderilemedi')}
                >
                  <Ionicons
                    name={r === 'Accepted' ? 'checkmark' : 'close'}
                    size={18}
                    color={selected ? colors.onAccent : color}
                  />
                  <Text style={[styles.respondText, { color: selected ? colors.onAccent : color }]}>
                    {r === 'Accepted' ? 'Katılıyorum' : 'Katılmıyorum'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {meeting.myResponse === 'Pending' && <Text style={styles.pendingHint}>Henüz yanıt vermedin.</Text>}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Katılımcılar · {accepted}/{meeting.participants.length} katılıyor
        </Text>

        {editable && (
          <Pressable style={styles.addRow} onPress={() => setAdding((a) => !a)}>
            <Ionicons name={adding ? 'close' : 'person-add'} size={18} color={colors.meetings.text} />
            <Text style={styles.addText}>{adding ? 'Vazgeç' : 'Katılımcı ekle'}</Text>
          </Pressable>
        )}
        {adding && (
          <View style={styles.search}>
            <UserSearch
              onSelect={handleAdd}
              excludeIds={meeting.participants.map((p) => p.userId)}
              placeholder="Davet edilecek kişiyi ara..."
              autoFocus
            />
          </View>
        )}

        {meeting.participants.map((p) => (
          <View key={p.userId} style={styles.participantRow}>
            <Avatar name={p.displayName} size={36} />
            <Text style={styles.participantName} numberOfLines={1}>
              {p.displayName}
              {p.userId === user?.id ? ' (sen)' : ''}
            </Text>
            <StatusTag kind={p.role === 'Organizer' ? 'Organizer' : p.response} />
            {editable && p.role !== 'Organizer' && (
              <Pressable onPress={() => confirmRemove(p)} hitSlop={8} style={styles.removeButton}>
                <Ionicons name="remove-circle-outline" size={22} color={colors.danger} />
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {editable && (
        <View style={styles.ownerActions}>
          <Pressable
            style={[styles.outlineButton, styles.flex]}
            onPress={() => navigation.navigate('MeetingForm', { meetingId })}
          >
            <Ionicons name="create-outline" size={18} color={colors.meetings.text} />
            <Text style={styles.outlineText}>Düzenle</Text>
          </Pressable>
          <Pressable style={[styles.dangerButton, styles.flex]} onPress={confirmCancel} disabled={busy}>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.dangerText}>İptal et</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.meetings.faint },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    error: { color: c.danger, fontSize: 16, textAlign: 'center' },
    cancelBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.dangerSoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    cancelText: { color: c.onDangerSoft, fontWeight: '700', fontSize: 15 },
    dateCard: {
      flexDirection: 'row',
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: c.meetings.border,
    },
    dateLeaf: {
      width: 64,
      borderRadius: 12,
      backgroundColor: c.meetings.solid,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    dateLeafCancelled: { backgroundColor: c.textMuted },
    leafMonth: { color: c.onAccent, fontSize: 13, fontWeight: '700' },
    leafDay: { color: c.onAccent, fontSize: 28, fontWeight: '800' },
    dateInfo: { flex: 1 },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    title: { flex: 1, fontSize: 20, fontWeight: '700', color: c.text },
    titleCancelled: { textDecorationLine: 'line-through', color: c.textMuted },
    dateText: { fontSize: 14, color: c.textSecondary, marginTop: 4 },
    organizer: { fontSize: 13, color: c.textTertiary, marginTop: 6 },
    description: { fontSize: 15, color: c.textSecondary, marginTop: 14, lineHeight: 21 },
    joinButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.chats.solid,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 18,
    },
    joinDisabled: { backgroundColor: c.disabled },
    joinText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
    joinHint: { textAlign: 'center', color: c.textTertiary, marginTop: 6, fontSize: 13 },
    section: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      marginTop: 16,
      borderWidth: 1,
      borderColor: c.meetings.border,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: c.meetings.onSoft, marginBottom: 10 },
    respondRow: { flexDirection: 'row', gap: 10 },
    respondButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderRadius: 10,
      paddingVertical: 12,
    },
    respondText: { fontWeight: '700' },
    pendingHint: { color: c.onWarningSoft, marginTop: 8, fontSize: 13 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    addText: { color: c.meetings.text, fontWeight: '700' },
    search: { paddingBottom: 8 },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    participantName: { flex: 1, fontSize: 15, color: c.text },
    removeButton: { marginLeft: 4 },
    ownerActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    flex: { flex: 1 },
    outlineButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.meetings.text,
      borderRadius: 10,
      paddingVertical: 14,
      backgroundColor: c.surface,
    },
    outlineText: { color: c.meetings.text, fontWeight: '700', fontSize: 16 },
    dangerButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: 14,
      backgroundColor: c.surface,
    },
    dangerText: { color: c.danger, fontWeight: '700', fontSize: 16 },
  });
