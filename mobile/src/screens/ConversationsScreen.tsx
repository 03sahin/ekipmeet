import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getConversations } from '../api/chat';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { connectRoomHub, onHubEvent, onReconnected } from '../realtime/roomHub';
import { ConversationMessage, ConversationSummary } from '../types/chat';
import { formatListTime } from '../utils/format';

// Sekme ekranı ama üstteki stack'e de (Chat, NewChat) gidebilmeli: iki navigator'ın tipini birleştiriyoruz
type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Conversations'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ConversationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Olay dinleyicisi içinden güncel listeye bakabilmek için
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const load = useCallback(async () => {
    try {
      setError(null);
      setConversations(await getConversations());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sohbetten geri dönünce okunmamış sayıları güncel olsun
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const offMessage = onHubEvent('ConversationMessage', (m: ConversationMessage) => {
      // Listede olmayan bir sohbetten mesaj geldiyse (yeni açılmış olabilir) listeyi baştan çek
      if (!conversationsRef.current.some((c) => c.id === m.conversationId)) {
        load();
        return;
      }
      // Varsa yerinde güncelle ve en üste taşı
      setConversations((prev) => {
        const current = prev.find((c) => c.id === m.conversationId);
        if (!current) return prev;
        const updated: ConversationSummary = {
          ...current,
          lastMessage: {
            senderId: m.senderId,
            senderName: m.senderName,
            text: m.text,
            createdAt: m.createdAt,
            attachmentName: m.attachment?.originalName ?? null,
            attachmentIsImage: m.attachment?.isImage ?? false,
          },
          lastMessageAt: m.createdAt,
          unreadCount: m.senderId === user?.id ? current.unreadCount : current.unreadCount + 1,
        };
        return [updated, ...prev.filter((c) => c.id !== m.conversationId)];
      });
    });
    const offChanged = onHubEvent('ConversationChanged', () => load()); // Yeni sohbet, üye değişikliği
    const offRemoved = onHubEvent('ConversationRemoved', (id: string) =>
      setConversations((prev) => prev.filter((c) => c.id !== id))
    );
    const offReconnected = onReconnected(load);
    connectRoomHub().catch(() => {}); // Bağlanamazsa liste yine çalışır, sadece canlı olmaz

    return () => {
      offMessage();
      offChanged();
      offRemoved();
      offReconnected();
    };
  }, [load, user?.id]);

  // Alt sekmedeki "Sohbetler" yazısının üstünde toplam okunmamış sayısı
  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    navigation.setOptions({ tabBarBadge: total > 0 ? (total > 99 ? '99+' : total) : undefined });
  }, [conversations, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  function renderPreview(c: ConversationSummary) {
    if (!c.lastMessage) return c.type === 'Group' ? 'Grup oluşturuldu' : 'Henüz mesaj yok';
    const prefix =
      c.lastMessage.senderId === user?.id ? 'Sen: ' : c.type === 'Group' ? `${c.lastMessage.senderName}: ` : '';
    const { attachmentName, attachmentIsImage, text } = c.lastMessage;
    const body = attachmentName ? (attachmentIsImage ? '📷 Fotoğraf' : `📎 ${attachmentName}`) : text;
    return prefix + body;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
        ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
        ListEmptyComponent={
          !error ? <Text style={styles.empty}>Henüz sohbet yok. Sağ alttaki butonla birine yaz.</Text> : undefined
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const unread = item.unreadCount > 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Chat', { conversationId: item.id, title: item.title })}
            >
              <Avatar name={item.title} isGroup={item.type === 'Group'} />
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={[styles.title, unread && styles.bold]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.time, unread && styles.timeUnread]}>{formatListTime(item.lastMessageAt)}</Text>
                </View>
                <View style={styles.bottomLine}>
                  <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                    {renderPreview(item)}
                  </Text>
                  {unread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.listContent}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('NewChat')}>
        <Ionicons name="create-outline" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 96 },
  error: { color: '#dc2626', padding: 16 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 48, fontSize: 15, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  pressed: { backgroundColor: '#f3f4f6' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb', marginLeft: 76 }, // Avatarın sağından başlar
  body: { flex: 1 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { flex: 1, fontSize: 16, color: '#111827', marginRight: 8 },
  bold: { fontWeight: '700' },
  time: { fontSize: 12, color: '#9ca3af' },
  timeUnread: { color: '#16a34a', fontWeight: '600' },
  bottomLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  preview: { flex: 1, fontSize: 14, color: '#6b7280', marginRight: 8 },
  previewUnread: { color: '#111827' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});
