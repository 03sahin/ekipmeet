import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ComponentProps, useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '../api/errors';
import { getNotifications, NOTIFICATION_PAGE_SIZE } from '../api/notifications';
import { RootStackParamList } from '../navigation/types';
import { useNotifications } from '../notifications/NotificationsContext';
import { openNotificationTarget } from '../notifications/openNotificationTarget';
import { onHubEvent } from '../realtime/roomHub';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { AppNotification, NotificationType } from '../types/notification';
import { formatListTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const ICONS: Record<NotificationType, { name: ComponentProps<typeof Ionicons>['name']; color: string }> = {
  ChatMessage: { name: 'chatbubble', color: '#16a34a' },
  MeetingInvited: { name: 'calendar', color: '#ea580c' },
  MeetingChanged: { name: 'create', color: '#2563eb' },
  MeetingCancelled: { name: 'close-circle', color: '#dc2626' },
  MeetingRemoved: { name: 'person-remove', color: '#6b7280' },
};

export default function NotificationsScreen({ navigation }: Props) {
  const { unreadCount, markRead, markAllRead } = useNotifications();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const page = await getNotifications();
      setItems(page);
      setHasMore(page.length === NOTIFICATION_PAGE_SIZE);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Ekrana her dönüşte güncel olsun; açıkken yeni bildirim gelirse en üste eklensin
  useFocusEffect(
    useCallback(() => {
      load();
      const off = onHubEvent('NotificationReceived', (n: AppNotification) =>
        setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]))
      );
      return off;
    }, [load])
  );

  const readAll = useCallback(async () => {
    try {
      await markAllRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    } catch (e) {
      Alert.alert('İşaretlenemedi', getErrorMessage(e));
    }
  }, [markAllRead]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unreadCount > 0 ? (
          <Pressable onPress={readAll} hitSlop={8}>
            <Text style={styles.readAll}>Tümünü okundu yap</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, unreadCount, readAll, styles]);

  async function loadMore() {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await getNotifications(items[items.length - 1].createdAt);
      setItems((prev) => [...prev, ...page.filter((n) => !prev.some((p) => p.id === n.id))]);
      setHasMore(page.length === NOTIFICATION_PAGE_SIZE);
    } catch {
      // Sessiz geç; tekrar kaydırınca yeniden dener
    } finally {
      setLoadingMore(false);
    }
  }

  function open(n: AppNotification) {
    if (!n.readAt) {
      markRead(n.id);
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, readAt: new Date().toISOString() } : p)));
    }
    openNotificationTarget({ type: n.type, ...n.data });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.chats.text} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(n) => n.id}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
      ListEmptyComponent={!error ? <Text style={styles.empty}>Henüz bildirimin yok.</Text> : undefined}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.chats.text} /> : undefined}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const icon = ICONS[item.type];
        const unread = !item.readAt;
        return (
          <Pressable style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.pressed]} onPress={() => open(item)}>
            <View style={[styles.icon, { backgroundColor: icon.color }]}>
              <Ionicons name={icon.name} size={18} color="#fff" />
            </View>
            <View style={styles.body}>
              <Text style={[styles.title, unread && styles.bold]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.text} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.time}>{formatListTime(item.createdAt)}</Text>
            </View>
            {unread && <View style={styles.dot} />}
          </Pressable>
        );
      }}
    />
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    readAll: { color: c.chats.text, fontWeight: '600' },
    error: { color: c.danger, padding: 16 },
    empty: { color: c.textTertiary, textAlign: 'center', marginTop: 48, fontSize: 15 },
    more: { marginVertical: 12 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    rowUnread: { backgroundColor: c.chats.faint },
    pressed: { backgroundColor: c.surfaceMuted },
    icon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    body: { flex: 1 },
    title: { fontSize: 15, color: c.text },
    bold: { fontWeight: '700' },
    text: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    time: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.chats.solid, marginTop: 6 },
  });
