import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMember, getConversation, leaveConversation } from '../api/chat';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import UserSearch from '../components/UserSearch';
import { RootStackParamList } from '../navigation/types';
import { onHubEvent } from '../realtime/roomHub';
import { ConversationDetail, UserSummary } from '../types/chat';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupInfo'>;

export default function GroupInfoScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false); // Arama kutusu açık mı
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getConversation(conversationId)
      .then(setDetail)
      .catch((e) => setError(getErrorMessage(e)));
  }, [conversationId]);

  useEffect(() => {
    load();
    // Başka biri üye ekler/ayrılırsa ya da sahiplik bize geçerse liste güncellensin
    return onHubEvent('ConversationChanged', (id: string) => {
      if (id === conversationId) load();
    });
  }, [conversationId, load]);

  async function handleAdd(member: UserSummary) {
    if (busy) return;
    setBusy(true);
    try {
      setDetail(await addMember(conversationId, member.id));
      setAdding(false);
    } catch (e) {
      Alert.alert('Eklenemedi', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave() {
    if (!detail) return;
    const isLast = detail.members.length === 1;
    Alert.alert(
      'Gruptan ayrıl',
      isLast
        ? `"${detail.title}" grubundaki son kişisin. Ayrılırsan grup ve tüm mesajlar silinecek.`
        : `"${detail.title}" grubundan ayrılmak istiyor musun?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveConversation(conversationId);
              // Canlı olay sohbet ekranını zaten kapatmış olabilir; ekran hâlâ açıksa biz kapatalım
              if (navigation.isFocused()) navigation.popToTop();
            } catch (e) {
              Alert.alert('Ayrılamadın', getErrorMessage(e));
            }
          },
        },
      ]
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  const isOwner = detail.myRole === 'Owner';

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Avatar name={detail.title} size={80} isGroup />
        <Text style={styles.title}>{detail.title}</Text>
        <Text style={styles.subtitle}>Grup · {detail.members.length} üye</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{detail.members.length} üye</Text>

        {/* Üye ekleme sadece sahibe görünür. Asıl kontrol backend'de (403). */}
        {isOwner && (
          <Pressable style={styles.addRow} onPress={() => setAdding((a) => !a)}>
            <View style={styles.addIcon}>
              <Ionicons name={adding ? 'close' : 'person-add'} size={20} color="#fff" />
            </View>
            <Text style={styles.addText}>{adding ? 'Vazgeç' : 'Üye ekle'}</Text>
          </Pressable>
        )}

        {adding && (
          <View style={styles.search}>
            <UserSearch
              onSelect={handleAdd}
              excludeIds={detail.members.map((m) => m.userId)}
              placeholder="Eklenecek kişiyi ara..."
              autoFocus
            />
          </View>
        )}

        {detail.members.map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            <Avatar name={m.displayName} size={40} />
            <Text style={styles.memberName}>
              {m.displayName}
              {m.userId === user?.id ? ' (sen)' : ''}
            </Text>
            {m.role === 'Owner' && <Text style={styles.ownerBadge}>Yönetici</Text>}
          </View>
        ))}
      </View>

      <Pressable style={styles.leaveButton} onPress={confirmLeave}>
        <Ionicons name="exit-outline" size={22} color="#dc2626" />
        <Text style={styles.leaveText}>Gruptan ayrıl</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  header: { backgroundColor: '#fff', alignItems: 'center', paddingVertical: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 12 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  section: { backgroundColor: '#fff', marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 13, color: '#16a34a', fontWeight: '600', paddingVertical: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: { fontSize: 16, color: '#16a34a', fontWeight: '600' },
  search: { paddingVertical: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  memberName: { flex: 1, fontSize: 16, color: '#111827' },
  ownerBadge: {
    fontSize: 12,
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    marginTop: 12,
    marginBottom: 32,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  leaveText: { fontSize: 16, color: '#dc2626', fontWeight: '600' },
});
