import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createDirect, createGroup } from '../api/chat';
import { getErrorMessage } from '../api/errors';
import UserSearch from '../components/UserSearch';
import { RootStackParamList } from '../navigation/types';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { UserSummary } from '../types/chat';

type Props = NativeStackScreenProps<RootStackParamList, 'NewChat'>;

export default function NewChatScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<UserSummary[]>([]); // Aramalar değişse de seçilenler kalsın
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: groupMode ? 'Yeni Grup' : 'Yeni Sohbet' });
  }, [groupMode, navigation]);

  // replace: Geri tuşuna basınca arama ekranına değil sohbet listesine dönülsün
  async function openDirect(user: UserSummary) {
    if (busy) return;
    setBusy(true);
    try {
      const conversation = await createDirect(user.id); // Varsa mevcut sohbet döner
      navigation.replace('Chat', { conversationId: conversation.id, title: conversation.title });
    } catch (e) {
      Alert.alert('Sohbet açılamadı', getErrorMessage(e));
      setBusy(false);
    }
  }

  function toggle(user: UserSummary) {
    setSelected((prev) => (prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]));
  }

  async function submitGroup() {
    if (busy) return;
    setBusy(true);
    try {
      const conversation = await createGroup(groupName.trim(), selected.map((u) => u.id));
      navigation.replace('Chat', { conversationId: conversation.id, title: conversation.title });
    } catch (e) {
      Alert.alert('Grup oluşturulamadı', getErrorMessage(e));
      setBusy(false);
    }
  }

  const canCreate = groupName.trim().length > 0 && selected.length > 0 && !busy;

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable
          style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}
          onPress={() => {
            setGroupMode((m) => !m);
            setSelected([]);
          }}
        >
          <Ionicons name={groupMode ? 'person-outline' : 'people-outline'} size={22} color={colors.chats.text} />
          <Text style={styles.modeText}>{groupMode ? 'Birebir sohbete dön' : 'Grup oluştur'}</Text>
        </Pressable>

        {groupMode && (
          <>
            <TextInput
              style={styles.nameInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Grup adı"
              placeholderTextColor={colors.placeholder}
              maxLength={100}
            />
            {selected.length > 0 && (
              <View style={styles.chips}>
                {selected.map((u) => (
                  <Pressable key={u.id} style={styles.chip} onPress={() => toggle(u)}>
                    <Text style={styles.chipText}>{u.displayName} ✕</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.sectionTitle}>Kişi ekle</Text>
          </>
        )}

        <UserSearch
          onSelect={groupMode ? toggle : openDirect}
          selectedIds={selected.map((u) => u.id)}
          placeholder={groupMode ? 'Gruba eklenecek kişiyi ara...' : 'Kime yazmak istiyorsun?'}
          autoFocus
        />
        {busy && !groupMode && <ActivityIndicator style={styles.busy} color={colors.chats.text} />}
      </ScrollView>

      {groupMode && (
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <Pressable
            style={[styles.createButton, !canCreate && styles.disabled]}
            onPress={submitGroup}
            disabled={!canCreate}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createText}>Grubu oluştur ({selected.length + 1} kişi)</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    content: { padding: 16 },
    modeButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginBottom: 8 },
    pressed: { opacity: 0.6 },
    modeText: { fontSize: 16, color: c.chats.text, fontWeight: '600' },
    nameInput: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
      marginBottom: 12,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { backgroundColor: c.chats.soft, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
    chipText: { color: c.chats.onSoft, fontWeight: '600' },
    sectionTitle: { fontSize: 13, color: c.textTertiary, fontWeight: '600', marginBottom: 8 },
    busy: { marginTop: 16 },
    footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    createButton: { backgroundColor: c.chats.solid, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    disabled: { opacity: 0.5 },
    createText: { color: c.onAccent, fontSize: 16, fontWeight: '600' },
  });
