import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getErrorMessage } from '../api/errors';
import { createMeeting, getMeeting, updateMeeting } from '../api/meetings';
import DateTimeField from '../components/meetings/DateTimeField';
import { DURATION_OPTIONS, MEETING } from '../components/meetings/theme';
import UserSearch from '../components/UserSearch';
import { RootStackParamList } from '../navigation/types';
import { UserSummary } from '../types/chat';
import { formatDuration, fromDateKey } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'MeetingForm'>;

// Varsayılan başlangıç: seçili günün 10:00'ı; o saat geçmişse bir sonraki tam saat
function defaultStart(dateKey?: string): Date {
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  if (!dateKey) return nextHour;
  const d = fromDateKey(dateKey);
  d.setHours(10, 0, 0, 0);
  return d > new Date() ? d : nextHour;
}

export default function MeetingFormScreen({ route, navigation }: Props) {
  const meetingId = route.params?.meetingId;
  const isEdit = !!meetingId;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => defaultStart(route.params?.date));
  const [originalStart, setOriginalStart] = useState<Date | null>(null);
  const [duration, setDuration] = useState(60);
  const [participants, setParticipants] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Toplantıyı Düzenle' : 'Toplantı Planla' });
  }, [isEdit, navigation]);

  // Düzenlemede mevcut bilgileri doldur
  useEffect(() => {
    if (!meetingId) return;
    getMeeting(meetingId)
      .then((m) => {
        setTitle(m.title);
        setDescription(m.description);
        setStartsAt(new Date(m.startsAt));
        setOriginalStart(new Date(m.startsAt));
        setDuration(m.durationMinutes);
      })
      .catch((e) => {
        Alert.alert('Yüklenemedi', getErrorMessage(e));
        navigation.goBack();
      })
      .finally(() => setLoading(false));
  }, [meetingId, navigation]);

  // Mevcut süre listede yoksa (örn. başka bir değerle kaydedilmiş) onu da seçenek olarak göster
  const durations = DURATION_OPTIONS.includes(duration) ? DURATION_OPTIONS : [...DURATION_OPTIONS, duration].sort((a, b) => a - b);

  function toggleParticipant(user: UserSummary) {
    setParticipants((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function save() {
    if (!title.trim()) {
      Alert.alert('Eksik bilgi', 'Toplantı başlığı yaz.');
      return;
    }
    // Saat değişmediyse (örn. sadece başlık düzenlendi) geçmiş kontrolü yapma; sunucu da aynı kuralı uygular
    const startChanged = !originalStart || Math.abs(startsAt.getTime() - originalStart.getTime()) >= 1000;
    if (startChanged && startsAt <= new Date()) {
      Alert.alert('Geçersiz saat', 'Başlangıç zamanı gelecekte olmalı.');
      return;
    }

    const input = { title: title.trim(), description: description.trim(), startsAt: startsAt.toISOString(), durationMinutes: duration };
    setSaving(true);
    try {
      if (meetingId) {
        await updateMeeting(meetingId, input);
        navigation.goBack();
      } else {
        const created = await createMeeting({ ...input, participantIds: participants.map((u) => u.id) });
        navigation.replace('MeetingDetail', { meetingId: created.id }); // Geri tuşu forma değil takvime dönsün
      }
    } catch (e) {
      Alert.alert('Kaydedilemedi', getErrorMessage(e));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={MEETING.primary} />
      </View>
    );
  }

  const timeEdited = isEdit && originalStart && (startsAt.getTime() !== originalStart.getTime());

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Başlık</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Örn. Haftalık planlama" maxLength={150} />

        <Text style={styles.label}>Açıklama</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Gündem, notlar (isteğe bağlı)"
          maxLength={1000}
          multiline
        />

        <Text style={styles.label}>Başlangıç</Text>
        <DateTimeField value={startsAt} onChange={setStartsAt} minimumDate={new Date()} />
        {timeEdited && (
          <Text style={styles.warning}>Saat değişirse katılımcıların yanıtları sıfırlanır, tekrar yanıt vermeleri gerekir.</Text>
        )}

        <Text style={styles.label}>Süre</Text>
        <View style={styles.chips}>
          {durations.map((d) => (
            <Pressable key={d} style={[styles.chip, duration === d && styles.chipActive]} onPress={() => setDuration(d)}>
              <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{formatDuration(d)}</Text>
            </Pressable>
          ))}
        </View>

        {isEdit ? (
          <Text style={styles.hint}>Katılımcıları toplantı detayından ekleyip çıkarabilirsin.</Text>
        ) : (
          <>
            <Text style={styles.label}>Katılımcılar {participants.length > 0 ? `(${participants.length})` : ''}</Text>
            {participants.length > 0 && (
              <View style={styles.chips}>
                {participants.map((u) => (
                  <Pressable key={u.id} style={styles.personChip} onPress={() => toggleParticipant(u)}>
                    <Text style={styles.personChipText}>{u.displayName} ✕</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <UserSearch
              onSelect={toggleParticipant}
              selectedIds={participants.map((u) => u.id)}
              placeholder="Davet edilecek kişiyi ara..."
            />
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={save} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>{isEdit ? 'Değişiklikleri kaydet' : 'Toplantıyı oluştur'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MEETING.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '700', color: MEETING.dark, marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: MEETING.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  warning: { color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, marginTop: 8, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MEETING.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: MEETING.primary, borderColor: MEETING.primary },
  chipText: { color: MEETING.dark, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  personChip: { backgroundColor: MEETING.light, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  personChipText: { color: MEETING.dark, fontWeight: '600' },
  hint: { color: '#6b7280', marginTop: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: MEETING.border, backgroundColor: '#fff' },
  saveButton: { backgroundColor: MEETING.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
