import Ionicons from '@expo/vector-icons/Ionicons';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { connectRoomHub, getHubErrorMessage, leaveRoom, onHubEvent, onReconnected } from '../realtime/roomHub';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { roomCallKey } from '../types/call';
import { ChatMessage, JoinRoomResult, RoomMember } from '../types/room';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomLive'>;

const MAX_LENGTH = 1000; // Backend'deki sınırla aynı

// Geçmiş ve canlı gelen mesajları birleştirir; aynı mesaj iki kez gelirse bir kez gösterir
function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  [...a, ...b].forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((x, y) => x.id - y.id);
}

export default function RoomLiveScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Ekran açılınca odaya katıl, kapanınca çık
  useEffect(() => {
    let active = true; // Ekran kapandıktan sonra gelen cevaplar state'i değiştirmesin

    const offMessage = onHubEvent('ReceiveMessage', (m: ChatMessage) => {
      if (m.roomId === roomId) setMessages((prev) => mergeMessages(prev, [m]));
    });
    const offPresence = onHubEvent('PresenceChanged', (id: number, list: RoomMember[]) => {
      if (id === roomId) setMembers(list);
    });
    const offDeleted = onHubEvent('RoomDeleted', (id: number) => {
      if (id !== roomId) return;
      Alert.alert('Oda silindi', 'Bu oda sahibi tarafından silindi.');
      navigation.popToTop();
    });

    async function join() {
      try {
        setError(null);
        const hub = await connectRoomHub();
        if (!active) return; // Bağlanırken ekrandan çıkıldıysa katılma
        const result = await hub.invoke<JoinRoomResult>('JoinRoom', roomId);
        if (!active) return;
        setMembers(result.members);
        setMessages((prev) => mergeMessages(result.messages, prev));
        setJoined(true);
      } catch (e) {
        if (active) setError(getHubErrorMessage(e));
      }
    }

    join();
    const offReconnected = onReconnected(join); // Bağlantı koptu-geldi: sunucu bizi unuttu, tekrar katıl

    return () => {
      active = false;
      offMessage();
      offPresence();
      offDeleted();
      offReconnected();
      leaveRoom();
    };
  }, [roomId, navigation]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const hub = await connectRoomHub();
      await hub.invoke('SendMessage', trimmed); // Mesaj bize de ReceiveMessage ile geri gelir
      setText('');
    } catch (e) {
      Alert.alert('Gönderilemedi', getHubErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (error && !joined) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!joined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.rooms.text} />
        <Text style={styles.hint}>Odaya bağlanılıyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding" // Klavye açılınca mesaj kutusu yukarı kayar
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      {/* İçeridekiler */}
      <View style={styles.membersBar}>
        <View style={styles.membersHeader}>
          <Text style={styles.membersTitle}>İçeride {members.length} kişi</Text>
          <Pressable
            style={styles.videoButton}
            onPress={() => navigation.navigate('Call', { callKey: roomCallKey(roomId), title: route.params.roomName })}
          >
            <Ionicons name="videocam" size={16} color="#fff" />
            <Text style={styles.videoText}>Görüntülü katıl</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {members.map((m) => (
            <View key={m.userId} style={[styles.chip, m.userId === user?.id && styles.chipMe]}>
              <Text style={styles.chipText}>{m.userId === user?.id ? `${m.displayName} (sen)` : m.displayName}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {error && <Text style={styles.banner}>{error}</Text>}

      {messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.hint}>Henüz mesaj yok. İlk mesajı sen yaz!</Text>
        </View>
      ) : (
        // inverted: liste alttan başlar, yeni mesaj en altta görünür
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(m) => String(m.id)}
          inverted
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {!mine && <Text style={styles.sender}>{item.senderName}</Text>}
                <Text style={mine ? styles.textMine : styles.textOther}>{item.text}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {new Date(item.sentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
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
          placeholder="Mesaj yaz..."
          placeholderTextColor={colors.placeholder}
          maxLength={MAX_LENGTH}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendText}>Gönder</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    error: { color: c.danger, fontSize: 16, textAlign: 'center' },
    hint: { color: c.textTertiary, marginTop: 12 },
    membersBar: { backgroundColor: c.surface, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    membersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginBottom: 6,
    },
    membersTitle: { fontSize: 13, color: c.textTertiary, fontWeight: '600' },
    videoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.chats.solid,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    videoText: { color: c.onAccent, fontWeight: '700', fontSize: 13 },
    chips: { paddingHorizontal: 16, gap: 8 },
    chip: { backgroundColor: c.surfaceMuted, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    chipMe: { backgroundColor: c.rooms.soft },
    chipText: { fontSize: 13, color: c.text },
    banner: { backgroundColor: c.dangerSoft, color: c.danger, padding: 8, textAlign: 'center' },
    messages: { padding: 12 },
    bubble: { maxWidth: '80%', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 4 },
    bubbleMine: { alignSelf: 'flex-end', backgroundColor: c.rooms.solid },
    bubbleOther: { alignSelf: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    sender: { fontSize: 12, fontWeight: '600', color: c.rooms.text, marginBottom: 2 },
    textMine: { color: c.onAccent, fontSize: 15 },
    textOther: { color: c.text, fontSize: 15 },
    time: { fontSize: 11, color: c.textMuted, marginTop: 4, alignSelf: 'flex-end' },
    timeMine: { color: '#bfdbfe' },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 15,
      color: c.text,
    },
    sendButton: { backgroundColor: c.rooms.solid, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 },
    sendDisabled: { opacity: 0.5 },
    sendText: { color: c.onAccent, fontWeight: '600' },
  });
