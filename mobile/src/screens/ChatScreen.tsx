import Ionicons from '@expo/vector-icons/Ionicons';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import {
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  PickedFile,
  uploadAttachment,
  UploadProgress,
} from '../api/attachments';
import { getConversation, getMessages, markRead, MESSAGE_PAGE_SIZE, sendMessage } from '../api/chat';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import AttachmentCard from '../components/chat/AttachmentCard';
import AttachmentSheet, { AttachmentSource } from '../components/chat/AttachmentSheet';
import AuthorizedImage from '../components/chat/AuthorizedImage';
import { RootStackParamList } from '../navigation/types';
import { closeConversation, connectRoomHub, onHubEvent, onReconnected, openConversation } from '../realtime/roomHub';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { ConversationDetail, ConversationMessage } from '../types/chat';
import { formatTime, mergeById } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const MAX_LENGTH = 1000; // Backend'deki sınırla aynı

// Belge seçicide gösterilecek türler (asıl kontrol backend'de dosya imzasıyla yapılır)
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'image/*',
];

type UploadState = { name: string; progress: UploadProgress | null };

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]); // Eskiden yeniye
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
              <Ionicons name="information-circle-outline" size={26} color={colors.chats.text} />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, detail, isGroup, conversationId, route.params.title, colors]);

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
    // Kopukken kaçırdığımız mesajları al; yeni bağlantıda "sohbet açık" bilgisini tekrar ver
    const offReconnected = onReconnected(() => {
      getMessages(conversationId)
        .then((page) => setMessages((prev) => mergeById(prev, page)))
        .catch(() => {});
      read();
      if (AppState.currentState === 'active') openConversation(conversationId);
    });
    // Arka plandan dönünce o arada gelenleri okundu say. Arka planda sohbet "açık" sayılmasın: bildirim gelsin.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        read();
        openConversation(conversationId);
      } else if (state === 'background') {
        closeConversation();
      }
    });
    connectRoomHub().catch(() => {});
    openConversation(conversationId);

    return () => {
      offMessage();
      offChanged();
      offRemoved();
      offReconnected();
      appState.remove();
      closeConversation();
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

  // Ekrandan çıkılırsa süren yükleme iptal edilsin
  useEffect(() => () => abortRef.current?.abort(), []);

  async function pickFile(source: AttachmentSource): Promise<PickedFile | null> {
    if (source === 'document') {
      const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, copyToCacheDirectory: true });
      if (result.canceled) return null;
      const a = result.assets[0];
      return { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size };
    }

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Kamera izni gerekli', 'Fotoğraf çekmek için Ayarlar > İzinler bölümünden kamerayı aç.');
        return null;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return null;
    const a = result.assets[0];
    const extension = a.mimeType === 'image/png' ? 'png' : a.mimeType === 'image/webp' ? 'webp' : 'jpg';
    return { uri: a.uri, name: a.fileName ?? `foto-${Date.now()}.${extension}`, mimeType: a.mimeType, size: a.fileSize };
  }

  async function sendAttachment(source: AttachmentSource) {
    if (upload) return;
    let picked: PickedFile | null;
    try {
      picked = await pickFile(source);
    } catch (e) {
      Alert.alert('Dosya seçilemedi', getErrorMessage(e));
      return;
    }
    if (!picked) return;
    if (picked.size && picked.size > MAX_ATTACHMENT_BYTES) {
      Alert.alert('Dosya çok büyük', `Seçtiğin dosya ${formatFileSize(picked.size)}. En fazla 10 MB gönderebilirsin.`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ name: picked.name, progress: null });
    try {
      // Kutuda yazılı metin varsa dosyanın açıklaması olarak gider
      const message = await uploadAttachment(conversationId, picked, {
        text: text.trim() || undefined,
        signal: controller.signal,
        onProgress: (progress) => setUpload((u) => (u ? { ...u, progress } : u)),
      });
      setMessages((prev) => mergeById(prev, [message]));
      setText('');
    } catch (e) {
      if (!controller.signal.aborted) Alert.alert('Gönderilemedi', getErrorMessage(e)); // İptal hata sayılmaz
    } finally {
      abortRef.current = null;
      setUpload(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.chats.text} />
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
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.older} color={colors.chats.text} /> : undefined}
          contentContainerStyle={styles.messages}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.id;
            // Grupta, art arda aynı kişinin mesajlarında adı sadece ilkinde göster
            const previous = reversed[index + 1];
            const showName = isGroup && !mine && previous?.senderId !== item.senderId;
            const attachment = item.attachment;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {showName && <Text style={styles.sender}>{item.senderName}</Text>}
                {attachment?.isImage && (
                  <Pressable
                    onPress={() =>
                      navigation.navigate('ImageViewer', { attachmentId: attachment.id, name: attachment.originalName })
                    }
                  >
                    <AuthorizedImage attachmentId={attachment.id} style={styles.imagePreview} resizeMode="cover" />
                  </Pressable>
                )}
                {attachment && !attachment.isImage && <AttachmentCard attachment={attachment} />}
                {item.text.length > 0 && <Text style={[styles.text, attachment && styles.caption]}>{item.text}</Text>}
                <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />
      )}

      {upload && (
        <View style={styles.uploadBar}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.chats.text} />
          <View style={styles.uploadInfo}>
            <Text style={styles.uploadName} numberOfLines={1}>
              {upload.name}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${upload.progress && upload.progress.total > 0 ? Math.min(100, (upload.progress.sent / upload.progress.total) * 100) : 0}%`,
                  },
                ]}
              />
            </View>
          </View>
          <Pressable onPress={() => abortRef.current?.abort()} hitSlop={8} accessibilityLabel="Yüklemeyi iptal et">
            <Ionicons name="close-circle" size={24} color={colors.danger} />
          </Pressable>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}>
        <Pressable
          style={[styles.attachButton, upload && styles.sendDisabled]}
          onPress={() => setSheetVisible(true)}
          disabled={!!upload}
          accessibilityLabel="Dosya ekle"
        >
          <Ionicons name="attach" size={24} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Mesaj"
          placeholderTextColor={colors.placeholder}
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

      <AttachmentSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onSelect={sendAttachment} />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.chatWallpaper }, // Mesajlaşma uygulaması tarzı zemin (açıkta bej)
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    error: { color: c.danger, fontSize: 16, textAlign: 'center' },
    hint: { color: c.textTertiary },
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
    bubbleMine: { alignSelf: 'flex-end', backgroundColor: c.bubbleMine, borderTopRightRadius: 2 },
    bubbleOther: { alignSelf: 'flex-start', backgroundColor: c.bubbleOther, borderTopLeftRadius: 2 },
    sender: { fontSize: 13, fontWeight: '700', color: c.chats.text, marginBottom: 2 },
    text: { color: c.bubbleText, fontSize: 15 },
    caption: { marginTop: 6 },
    imagePreview: { width: 220, height: 220, borderRadius: 8, backgroundColor: c.surfaceMuted },
    uploadBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 8,
      marginTop: 6,
      padding: 10,
      borderRadius: 12,
      backgroundColor: c.surface,
    },
    uploadInfo: { flex: 1 },
    uploadName: { fontSize: 13, color: c.text, marginBottom: 6 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
    progressFill: { height: 4, backgroundColor: c.chats.solid },
    attachButton: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center' },
    time: { fontSize: 11, color: c.bubbleTime, marginTop: 2, alignSelf: 'flex-end' },
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
      backgroundColor: c.chatInput,
      color: c.text,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.chats.solid,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendDisabled: { opacity: 0.5 },
  });
