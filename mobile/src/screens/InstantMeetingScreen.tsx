import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getErrorMessage } from '../api/errors';
import { createInstantMeeting } from '../api/meetings';

import UserSearch from '../components/UserSearch';
import { RootStackParamList } from '../navigation/types';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { UserSummary } from '../types/chat';

type Props = NativeStackScreenProps<RootStackParamList, 'InstantMeeting'>;

// Hemen başlayan 60 dakikalık toplantı: başlık ve katılımcılar isteğe bağlı
export default function InstantMeetingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState<UserSummary[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(user: UserSummary) {
    setParticipants((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const meeting = await createInstantMeeting(title, participants.map((u) => u.id));
      navigation.replace('MeetingDetail', { meetingId: meeting.id });
    } catch (e) {
      Alert.alert('Başlatılamadı', getErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="flash" size={32} color={colors.meetings.text} />
          <Text style={styles.heroText}>Şimdi başlar, 60 dakika sürer.</Text>
        </View>

        <Text style={styles.label}>Başlık (isteğe bağlı)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Hızlı toplantı"
          placeholderTextColor={colors.placeholder}
          maxLength={150}
        />

        <Text style={styles.label}>Kimleri çağıralım? (isteğe bağlı)</Text>
        {participants.length > 0 && (
          <View style={styles.chips}>
            {participants.map((u) => (
              <Pressable key={u.id} style={styles.chip} onPress={() => toggle(u)}>
                <Text style={styles.chipText}>{u.displayName} ✕</Text>
              </Pressable>
            ))}
          </View>
        )}
        <UserSearch onSelect={toggle} selectedIds={participants.map((u) => u.id)} placeholder="Kişi ara..." />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={[styles.startButton, busy && styles.disabled]} onPress={start} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.startText}>Şimdi başlat</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.meetings.faint },
    content: { padding: 16 },
    hero: {
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.meetings.soft,
      borderRadius: 16,
      paddingVertical: 20,
      borderWidth: 1,
      borderColor: c.meetings.border,
    },
    heroText: { color: c.meetings.onSoft, fontWeight: '600' },
    label: { fontSize: 13, fontWeight: '700', color: c.meetings.onSoft, marginTop: 18, marginBottom: 8 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.meetings.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: { backgroundColor: c.meetings.soft, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
    chipText: { color: c.meetings.onSoft, fontWeight: '600' },
    footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.meetings.border, backgroundColor: c.surface },
    startButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.meetings.solid,
      paddingVertical: 14,
      borderRadius: 10,
    },
    disabled: { opacity: 0.6 },
    startText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  });
