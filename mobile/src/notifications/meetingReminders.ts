import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { getUpcomingMeetings } from '../api/meetings';
import { MEETING_CHANNEL } from './push';

const PREFIX = 'meeting-reminder-';
const REMIND_BEFORE_MS = 10 * 60 * 1000;

let running: Promise<void> | null = null;
let again = false;
let askedExactAlarm = false; // Uygulama açıkken en fazla bir kez soralım

// Android 12+ "tam zamanlı alarm" izni yoksa hatırlatıcı yaklaşık zamanlı kurulur ve
// Xiaomi gibi cihazlarda pil tasarrufu yüzünden çok geç gelir ya da hiç gelmez.
// Android 13'te izin manifest'te tanımlıysa otomatik verilir; Android 14+'te kullanıcı Ayarlar'dan açar.
async function ensureExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if ((await Notifications.getExactAlarmPermissionsAsync()).granted) return true;
  if (askedExactAlarm) return false;
  askedExactAlarm = true;

  const allow = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Toplantı hatırlatıcıları',
      'Toplantılardan 10 dakika önce zamanında haber verebilmemiz için bir sonraki ekranda "Alarm ve hatırlatıcılar" iznini aç.',
      [
        { text: 'Şimdi değil', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Ayarlara git', onPress: () => resolve(true) },
      ]
    )
  );
  if (!allow) return false;
  return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
}

// Kabul ettiğim ya da düzenlediğim, iptal edilmemiş toplantılar için başlangıçtan 10 dk önce yerel bildirim.
// Her seferinde mevcut hatırlatıcılar silinip baştan kurulur: saat değişti, iptal edildi, çıkarıldım,
// yanıtım değişti gibi durumların hepsi aynı yoldan güncellenir.
export function syncMeetingReminders(): Promise<void> {
  // Arka arkaya gelen olaylarda aynı anda iki senkron çalışmasın; bitince bir kez daha çalışsın
  if (running) {
    again = true;
    return running;
  }
  running = doSync()
    .catch(() => {}) // İnternet yoksa mevcut hatırlatıcılar kalır, sonra tekrar denenir
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        syncMeetingReminders();
      }
    });
  return running;
}

async function doSync() {
  const meetings = await getUpcomingMeetings();
  const now = Date.now();
  const wanted = meetings.filter(
    (m) =>
      m.status === 'Scheduled' &&
      (m.isOrganizer || m.myResponse === 'Accepted') &&
      new Date(m.startsAt).getTime() - REMIND_BEFORE_MS > now
  );

  // İzin verilmese de kurarız (yaklaşık zamanlı); hiç gelmemesinden iyidir
  if (wanted.length > 0) await ensureExactAlarmPermission();

  await cancelAllMeetingReminders();
  for (const m of wanted) {
    const start = new Date(m.startsAt);
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + m.id,
      content: {
        title: 'Toplantı 10 dakika sonra',
        body: `"${m.title}" ${start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'de başlıyor.`,
        data: { type: 'MeetingReminder', meetingId: m.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(start.getTime() - REMIND_BEFORE_MS),
        channelId: MEETING_CHANNEL,
      },
    });
  }
}

// Çıkış yapınca: başka kullanıcının toplantısı bu cihazda hatırlatılmasın
export async function cancelAllMeetingReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}
