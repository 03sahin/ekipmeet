import { navigationRef, whenNavigationReady } from '../navigation/navigationRef';

// Bildirimin götürdüğü yer. Hem uygulama içi listeden, hem push'tan, hem hatırlatıcıdan çağrılır.
export type NotificationTarget = {
  type?: string; // NotificationType ya da yerel hatırlatıcı için "MeetingReminder"
  conversationId?: string;
  conversationTitle?: string;
  meetingId?: string;
};

export function openNotificationTarget(target: NotificationTarget) {
  whenNavigationReady(() => {
    if (target.conversationId) {
      navigationRef.navigate('Chat', { conversationId: target.conversationId, title: target.conversationTitle ?? '' });
    } else if (target.type === 'MeetingRemoved') {
      navigationRef.navigate('Tabs', { screen: 'Meetings' }); // Artık toplantıyı göremez; listeye git
    } else if (target.meetingId) {
      navigationRef.navigate('MeetingDetail', { meetingId: target.meetingId });
    }
  });
}

// Push/yerel bildirimin data'sı serbest biçimli; sadece metin alanları alınır
export function targetFromData(data: Record<string, unknown> | undefined): NotificationTarget & { notificationId?: string } {
  const str = (key: string) => (typeof data?.[key] === 'string' ? (data[key] as string) : undefined);
  return {
    type: str('type'),
    conversationId: str('conversationId'),
    conversationTitle: str('conversationTitle'),
    meetingId: str('meetingId'),
    notificationId: str('notificationId'),
  };
}
