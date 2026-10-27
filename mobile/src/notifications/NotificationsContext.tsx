import * as Notifications from 'expo-notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import InAppBanner, { BannerContent } from '../components/InAppBanner';
import { navigationRef } from '../navigation/navigationRef';
import { connectRoomHub, onHubEvent, onReconnected } from '../realtime/roomHub';
import { AppNotification } from '../types/notification';
import { syncMeetingReminders } from './meetingReminders';
import { NotificationTarget, openNotificationTarget, targetFromData } from './openNotificationTarget';
import { configureNotifications, registerForPush } from './push';

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnread: () => void;
  markRead: (id: string) => void;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const MEETING_EVENTS = ['MeetingInvited', 'MeetingChanged', 'MeetingCancelled', 'MeetingRemoved'];

configureNotifications(); // Modül yüklenince bir kez (bildirim işleyicisi ve Android kanalları)

type Banner = BannerContent & { target: NotificationTarget; notificationId?: string };

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const shown = useRef(new Set<string>()); // Aynı bildirim hem SignalR'dan hem push'tan gelirse bir kez göster
  const handledResponses = useRef(new Set<string>());

  const refreshUnread = useCallback(() => {
    getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  const markRead = useCallback(
    (id: string) => {
      markNotificationRead(id)
        .then(refreshUnread)
        .catch(() => {});
    },
    [refreshUnread]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
  }, []);

  const showBanner = useCallback((b: Banner) => {
    if (shown.current.has(b.key)) return;
    shown.current.add(b.key);
    // Bildirimin götürdüğü sohbet zaten açıksa banner gereksiz (sunucu çoğu zaman göndermez de)
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
    if (b.target.conversationId && route?.name === 'Chat' && (route.params as any)?.conversationId === b.target.conversationId)
      return;
    setBanner(b);
  }, []);

  // Push'a ya da hatırlatıcıya dokunuldu (uygulama arka plandayken ya da kapalıyken açıldıysa da)
  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledResponses.current.has(id)) return;
      handledResponses.current.add(id);
      Notifications.clearLastNotificationResponse(); // Uygulama tekrar açılınca aynı bildirime yeniden gitme

      const target = targetFromData(response.notification.request.content.data);
      if (target.notificationId) markRead(target.notificationId);
      openNotificationTarget(target);
    },
    [markRead]
  );

  useEffect(() => {
    if (!user) return; // Çıkış yapılınca sayaç aşağıda 0 gösterilir

    refreshUnread();
    registerForPush();
    syncMeetingReminders();

    const offs = [
      // Uygulama açıkken gelen bildirim: SignalR ile anında gelir (push yapılandırılmasa bile)
      onHubEvent('NotificationReceived', (n: AppNotification) => {
        setUnreadCount((c) => c + 1);
        showBanner({
          key: n.id,
          notificationId: n.id,
          title: n.title,
          body: n.body,
          icon: n.type === 'ChatMessage' ? 'chatbubble' : 'calendar',
          target: { type: n.type, ...n.data },
        });
      }),
      onHubEvent('NotificationsChanged', refreshUnread), // Başka cihazda okundu işaretlendi
      onReconnected(refreshUnread),
      // Toplantı değişti/iptal/çıkarıldım/yanıtım değişti: hatırlatıcıları güncelle
      ...MEETING_EVENTS.map((event) => onHubEvent(event, () => syncMeetingReminders())),
    ];
    connectRoomHub().catch(() => {});

    // Uygulama öndeyken gelen push ya da hatırlatıcı (setNotificationHandler sistem bildirimini gizledi)
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const target = targetFromData(data);
      showBanner({
        key: target.notificationId ?? notification.request.identifier,
        notificationId: target.notificationId,
        title: title ?? '',
        body: body ?? '',
        icon: target.type === 'MeetingReminder' ? 'alarm' : target.conversationId ? 'chatbubble' : 'calendar',
        target,
      });
    });
    const responses = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Uygulama kapalıyken bildirime dokunularak açıldıysa
    const last = Notifications.getLastNotificationResponse();
    if (last) handleResponse(last);

    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshUnread();
      syncMeetingReminders();
    });

    return () => {
      offs.forEach((off) => off());
      received.remove();
      responses.remove();
      appState.remove();
    };
  }, [user, refreshUnread, showBanner, handleResponse]);

  const hideBanner = useCallback(() => setBanner(null), []);

  function pressBanner() {
    if (!banner) return;
    if (banner.notificationId) markRead(banner.notificationId);
    openNotificationTarget(banner.target);
    setBanner(null);
  }

  return (
    <NotificationsContext.Provider value={{ unreadCount: user ? unreadCount : 0, refreshUnread, markRead, markAllRead }}>
      {children}
      <InAppBanner content={banner} onPress={pressBanner} onHide={hideBanner} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications, NotificationsProvider içinde kullanılmalı.');
  return ctx;
}
