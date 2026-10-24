import Ionicons from '@expo/vector-icons/Ionicons';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getConversation, getMessages, markRead, MESSAGE_PAGE_SIZE, sendMessage } from '../api/chat';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { connectRoomHub, onHubEvent, onReconnected } from '../realtime/roomHub';
import { ConversationDetail, ConversationMessage } from '../types/chat';
import { formatTime, mergeById } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const MAX_LENGTH = 1000; // Backend'deki sınırla aynı

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]); // Eskiden yeniye
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const isGroup = detail?.type === 'Group';

  const read = useCallback(() => {
    markRead(conversationId).catch(() => {}); // Başarısız olursa bir sonraki açılışta tekrar denenir
  }, [conversationId]);

  const loadDetail = useCallback(() => {
    getConversation(conversationId).then(setDetail).catch(() => {});
  }, [conversationId]);

  // Başlık ve (grupsa) sağ üstte bilgi butonu
  useLayoutEffect(() => {
    navigation.setOptions({
      title: detail?.title ?? route.params.title,
      headerRight: isGroup
        ? () => (
            <Pressable onPress={() => navigation.navigate('GroupInfo', { conversationId })} hitSlop={8}>
              <Ionicons name="information-circle-outline" size={26} color="#16a34a" />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, detail, isGroup, conversationId, route.params.title]);

  // İlk yükleme: detay + son 50 mesaj, sonra okundu işaretle
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [d, page] = await Promise.all([getConversation(conversationId), getMessages(conversationId)]);
        if (!active) return;
        setDetail(d);
        setMessages((prev) => mergeById(page, prev)); // Bu arada canlı gelen olduysa kaybolmasın
        setHasMore(page.length === MESSAGE_PAGE_SIZE);
        read();
      } catch (e) {
        if (active) setError(getErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [conversationId, read]);

  // Canlı olaylar
  useEffect(() => {
    const offMessage = onHubEvent('ConversationMessage', (m: ConversationMessage) => {
      if (m.conversationId !== conversationId) return;
      setMessages((prev) => mergeById(prev, [m]));
      // Ekran açıkken (ve uygulama ön plandayken) gelen mesaj okunmuş sayılır
      if (m.senderId !== user?.id && AppState.currentState === 'active') read();
    });
    const offChanged = onHubEvent('ConversationChanged', (id: string) => {
      if (id === conversationId) loadDetail(); // Üye eklendi/ayrıldı
    });
    const offRemoved = onHubEvent('ConversationRemoved', (id: string) => {
      // Gruptan ayrıldık (bu cihazdan ya da başka cihazdan): sohbet ekranında kalmanın anlamı yok
      if (id === conversationId && navigation.canGoBack()) navigation.popToTop();
    });
    // Kopukken kaçırdığımız mesajları al
    const offReconnected = onReconnected(() => {
      getMessages(conversationId)
        .then((page) => setMessages((prev) => mergeById(prev, page)))
        .catch(() => {});
      read();
    });
    // Arka plandan dönünce o arada gelenleri okundu say
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    connectRoomHub().catch(() => {});

    return () => {
      offMessage();
      offChanged();
      offRemoved();
      offReconnected();
      appState.remove();
    };
  }, [conversationId, user?.id, read, loadDetail, navigation]);

  async function loadOlder() {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const page = await getMessages(conversationId, messages[0].id); // En eski mesajdan öncekiler
      setMessages((prev) => mergeById(page, prev));
      setHasMore(page.length === MESSAGE_PAGE_SIZE);
    } catch {
      // Sessiz geç; kullanıcı tekrar kaydırınca yeniden dener
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const message = await sendMessage(conversationId, trimmed);
      setMessages((prev) => mergeById(prev, [message])); // Canlı olay da gelecek; id aynı olduğu için tekrar etmez
      setText('');
    } catch (e) {
      Alert.alert('Gönderilemedi', getErrorMessage(e)); // Yazılan metin silinmez, tekrar denenebilir
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  // inverted listede index 0 en yeni mesajdır
  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      {messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.hint}>Henüz mesaj yok. Bir merhaba yaz 👋</Text>
        </View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(m) => String(m.id)}
          inverted // Alttan başlar; "liste sonu" en üstte olur
          onEndReached={loadOlder} // Yukarı kaydırıp en üste gelince eski mesajlar
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.older} color="#16a34a" /> : undefined}
          contentContainerStyle={styles.messages}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.id;
            // Grupta, art arda aynı kişinin mesajlarında adı sadece ilkinde göster
            const previous = reversed[index + 1];
            const showName = isGroup && !mine && previous?.senderId !== item.senderId;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {showName && <Text style={styles.sender}>{item.senderName}</Text>}
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Mesaj"
          maxLength={MAX_LENGTH}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#efeae2' }, // Mesajlaşma uygulaması tarzı açık bej zemin
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  hint: { color: '#6b7280' },
  older: { marginVertical: 12 },
  messages: { paddingHorizontal: 10, paddingVertical: 8 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 2,
    elevation: 1,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#d9fdd3', borderTopRightRadius: 2 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#fff', borderTopLeftRadius: 2 },
  sender: { fontSize: 13, fontWeight: '700', color: '#16a34a', marginBottom: 2 },
  text: { color: '#111827', fontSize: 15 },
  time: { fontSize: 11, color: '#6b7280', marginTop: 2, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});
