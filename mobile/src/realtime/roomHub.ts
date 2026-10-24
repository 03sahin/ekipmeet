import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { ApiError, getValidAccessToken } from '../api/client';
import { API_URL } from '../api/config';

// Uygulamada TEK bir hub bağlantısı var; tüm ekranlar bunu paylaşır
let connection: HubConnection | null = null;
let startPromise: Promise<HubConnection> | null = null;
const reconnectedListeners = new Set<() => void>();
const reconnectingListeners = new Set<() => void>();
const closedListeners = new Set<() => void>();

function getConnection(): HubConnection {
  if (!connection) {
    connection = new HubConnectionBuilder()
      // accessTokenFactory her bağlanma/yeniden bağlanmada çağrılır; token eskiyse önce yenilenir
      .withUrl(`${API_URL}/hubs/rooms`, { accessTokenFactory: getValidAccessToken })
      .withAutomaticReconnect() // İnternet gidip gelirse kendisi tekrar bağlanır
      .configureLogging(LogLevel.Warning)
      .build();
    // Yeniden bağlanınca sunucu bizi yeni bir bağlantı olarak görür; ekranlar odaya tekrar katılmalı
    connection.onreconnected(() => reconnectedListeners.forEach((listener) => listener()));
    // Görüşme ekranı bağlantı koptuğunda eşleri kapatır; yeniden denemeler de biterse (onclose) görüşmeden çıkar
    connection.onreconnecting(() => reconnectingListeners.forEach((listener) => listener()));
    connection.onclose(() => closedListeners.forEach((listener) => listener()));
  }
  return connection;
}

// Bağlı değilse bağlanır; aynı anda birden çok ekran çağırırsa tek bağlantı kurulur
export function connectRoomHub(): Promise<HubConnection> {
  const conn = getConnection();
  if (conn.state === HubConnectionState.Connected) return Promise.resolve(conn);
  if (startPromise) return startPromise;
  if (conn.state !== HubConnectionState.Disconnected) {
    return Promise.reject(new Error('Bağlantı yeniden kuruluyor, birazdan tekrar dene.'));
  }

  startPromise = conn
    .start()
    .then(() => conn)
    .finally(() => {
      startPromise = null;
    });
  return startPromise;
}

// Sunucudan gelen olayı dinler; dönen fonksiyon dinlemeyi bırakır (useEffect temizliği için)
export function onHubEvent(event: string, handler: (...args: any[]) => void): () => void {
  const conn = getConnection();
  conn.on(event, handler);
  return () => conn.off(event, handler);
}

function subscribe(listeners: Set<() => void>, listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const onReconnected = (listener: () => void) => subscribe(reconnectedListeners, listener);
export const onReconnecting = (listener: () => void) => subscribe(reconnectingListeners, listener);
export const onClosed = (listener: () => void) => subscribe(closedListeners, listener);

// Ekrandan çıkarken: bağlıysa odadan çık, değilse yapacak bir şey yok (sunucu kopunca zaten çıkarır)
export function leaveRoom() {
  if (connection?.state === HubConnectionState.Connected) {
    connection.invoke('LeaveRoom').catch(() => {});
  }
}

// Görüşme ekranından çıkarken; bağlantı yoksa sunucu kopunca zaten çıkarır
export function leaveCall() {
  if (connection?.state === HubConnectionState.Connected) {
    connection.invoke('LeaveCall').catch(() => {});
  }
}

// Çıkış yapınca bağlantıyı kapat; sonraki girişte yeni kullanıcının token'ıyla yeniden kurulur
export async function stopRoomHub() {
  const conn = connection;
  connection = null;
  startPromise = null;
  await conn?.stop().catch(() => {});
}

// Sunucudaki HubException mesajı "... HubException: <mesaj>" şeklinde gelir; sadece mesajı al
export function getHubErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message; // Örn. oturum süresi doldu
  if (e instanceof Error) {
    const match = e.message.match(/HubException: (.*)$/);
    if (match) return match[1];
    if (e.message.startsWith('Bağlantı')) return e.message;
  }
  return 'Canlı bağlantı kurulamadı. Backend çalışıyor mu?';
}
