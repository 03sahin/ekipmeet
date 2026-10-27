import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice, unregisterDevice } from '../api/notifications';

// Backend push'ları bu kanaldan gönderir (channelId: "default"); hatırlatıcılar ayrı kanalda
export const DEFAULT_CHANNEL = 'default';
export const MEETING_CHANNEL = 'meetings';

let currentToken: string | null = null; // Çıkışta backend'den silmek için

// Uygulama açılışında bir kez: uygulama öndeyken bildirim sistem çubuğunda gösterilmez,
// onun yerine uygulama içi banner çıkar (NotificationsProvider)
export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL, {
      name: 'Mesajlar ve toplantılar',
      importance: AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(MEETING_CHANNEL, {
      name: 'Toplantı hatırlatıcıları',
      importance: AndroidImportance.HIGH,
    });
  }
}

// İzin isteyip Expo push token'ını alır ve backend'e kaydeder. Push yapılandırılmamışsa
// (EAS projectId ya da Firebase yoksa) sessizce vazgeçer: uygulama içi bildirimler yine çalışır.
export async function registerForPush(): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return; // Kullanıcı izin vermedi

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push: EAS projectId bulunamadı, push kaydı atlandı.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(token, Platform.OS);
    currentToken = token;
  } catch (e) {
    console.warn('Push kaydı yapılamadı:', e); // Örn. google-services.json yok
  }
}

// Çıkış yaparken (oturum hâlâ geçerliyken) çağrılır: bu cihaza artık bildirim gitmesin
export async function unregisterPush() {
  const token = currentToken;
  currentToken = null;
  if (token) await unregisterDevice(token).catch(() => {});
}
