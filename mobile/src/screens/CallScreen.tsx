import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { CallSession, CallSnapshot } from '../call/CallSession';
import { requestCallPermissions } from '../call/permissions';
import CallGrid from '../components/call/CallGrid';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Call'>;

type Status =
  | { kind: 'starting' } // İzin isteniyor / kamera açılıyor / katılınıyor
  | { kind: 'denied'; blocked: boolean } // blocked: "Bir daha sorma" seçilmiş
  | { kind: 'error'; message: string }
  | { kind: 'active' };

export default function CallScreen({ route, navigation }: Props) {
  const { callKey, title } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  useKeepAwake(); // Görüşme sırasında ekran kararmasın

  const [status, setStatus] = useState<Status>({ kind: 'starting' });
  const [snapshot, setSnapshot] = useState<CallSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0); // "Tekrar dene" baştan başlatsın
  const sessionRef = useRef<CallSession | null>(null);
  const displayName = user?.displayName ?? 'Ben';

  // Ekran açılınca: izin → kamera → görüşmeye katıl. Ekrandan çıkınca (geri tuşu dahil) her şeyi kapat.
  useEffect(() => {
    let active = true;
    let session: CallSession | null = null;
    setStatus({ kind: 'starting' });
    setSnapshot(null);

    (async () => {
      const permission = await requestCallPermissions();
      if (!active) return;
      if (permission !== 'granted') {
        setStatus({ kind: 'denied', blocked: permission === 'blocked' });
        return;
      }

      session = new CallSession(callKey, displayName, {
        onChange: (s) => {
          if (active) setSnapshot(s);
        },
        onEnded: (message) => {
          if (!active) return;
          Alert.alert('Görüşme sona erdi', message);
          if (navigation.canGoBack()) navigation.goBack();
        },
      });
      sessionRef.current = session;

      try {
        await session.start();
        if (active) setStatus({ kind: 'active' });
      } catch (e) {
        session.leave();
        if (active) setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Görüşmeye katılınamadı.' });
      }
    })();

    return () => {
      active = false;
      session?.leave(); // Track'ler durur, peer bağlantıları kapanır, sunucuya LeaveCall gider
      sessionRef.current = null;
    };
  }, [callKey, displayName, navigation, attempt]);

  // Arka plana atılınca Android kamerayı keser; diğerlerine donmuş kare yerine "kamera kapalı" görünsün.
  // Uygulama öldürülürse bağlantı kopar ve sunucu bizi görüşmeden kendisi çıkarır.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      sessionRef.current?.setInBackground(state === 'background');
    });
    return () => sub.remove();
  }, []);

  const leave = () => navigation.goBack(); // Temizliği useEffect'in dönüşü yapar

  if (status.kind === 'denied') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="videocam-off" size={48} color="#f87171" />
        <Text style={styles.messageTitle}>Kamera ve mikrofon izni gerekli</Text>
        <Text style={styles.message}>
          {status.blocked
            ? 'İzinleri kalıcı olarak reddettin. Ayarlar > İzinler bölümünden kamera ve mikrofonu açıp tekrar dene.'
            : 'Görüntülü görüşmeye katılmak için kamera ve mikrofon iznini vermelisin.'}
        </Text>
        {status.blocked && <MessageButton label="Ayarları aç" onPress={() => Linking.openSettings()} primary />}
        <MessageButton label="Tekrar dene" onPress={() => setAttempt((a) => a + 1)} primary={!status.blocked} />
        <MessageButton label="Geri dön" onPress={leave} />
      </View>
    );
  }

  if (status.kind === 'error') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={48} color="#f87171" />
        <Text style={styles.messageTitle}>Görüşmeye katılınamadı</Text>
        <Text style={styles.message}>{status.message}</Text>
        <MessageButton label="Tekrar dene" onPress={() => setAttempt((a) => a + 1)} primary />
        <MessageButton label="Geri dön" onPress={leave} />
      </View>
    );
  }

  if (!snapshot) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.message}>Kamera açılıyor...</Text>
      </View>
    );
  }

  const session = sessionRef.current;
  const banner =
    snapshot.phase === 'reconnecting'
      ? 'Bağlantı koptu, yeniden bağlanılıyor...'
      : snapshot.phase === 'joining'
        ? 'Görüşmeye bağlanılıyor...'
        : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.count}>{snapshot.tiles.length}/6 kişi</Text>
      </View>
      {banner && <Text style={styles.banner}>{banner}</Text>}

      <CallGrid tiles={snapshot.tiles} facing={snapshot.facing} />

      <View style={[styles.controls, { paddingBottom: 12 + insets.bottom }]}>
        <ControlButton
          icon={snapshot.audioEnabled ? 'mic' : 'mic-off'}
          label={snapshot.audioEnabled ? 'Sessize al' : 'Sesi aç'}
          off={!snapshot.audioEnabled}
          onPress={() => session?.toggleAudio()}
        />
        <ControlButton
          icon={snapshot.videoEnabled ? 'videocam' : 'videocam-off'}
          label={snapshot.videoEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'}
          off={!snapshot.videoEnabled}
          onPress={() => session?.toggleVideo()}
        />
        <ControlButton
          icon="camera-reverse"
          label="Kamerayı çevir"
          disabled={!snapshot.videoEnabled}
          onPress={() => session?.switchCamera()}
        />
        <ControlButton icon="call" label="Ayrıl" danger onPress={leave} />
      </View>
    </View>
  );
}

type ControlProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  off?: boolean; // Kapalı durumdaki buton beyaz görünür (dikkat çeksin)
  danger?: boolean;
  disabled?: boolean;
};

function ControlButton({ icon, label, onPress, off, danger, disabled }: ControlProps) {
  return (
    <Pressable style={styles.control} onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <View
        style={[
          styles.controlCircle,
          off && styles.controlOff,
          danger && styles.controlDanger,
          disabled && styles.controlDisabled,
        ]}
      >
        <Ionicons
          name={icon}
          size={26}
          color={off ? '#111827' : '#fff'}
          style={danger ? { transform: [{ rotate: '135deg' }] } : undefined} // Telefonu kapatma simgesi
        />
      </View>
      <Text style={styles.controlLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MessageButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable style={[styles.messageButton, primary && styles.messageButtonPrimary]} onPress={onPress}>
      <Text style={[styles.messageButtonText, primary && styles.messageButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#111827' },
  messageTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  message: { color: '#d1d5db', fontSize: 15, marginTop: 8, marginBottom: 20, textAlign: 'center', lineHeight: 21 },
  messageButton: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  messageButtonPrimary: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  messageButtonText: { color: '#d1d5db', fontWeight: '700', fontSize: 16 },
  messageButtonTextPrimary: { color: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  count: { color: '#9ca3af', fontSize: 13 },
  banner: { backgroundColor: '#92400e', color: '#fff', textAlign: 'center', paddingVertical: 6, fontSize: 13 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: '#0b1220',
  },
  control: { alignItems: 'center', width: 80 },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlOff: { backgroundColor: '#f9fafb' },
  controlDanger: { backgroundColor: '#dc2626' },
  controlDisabled: { opacity: 0.4 },
  controlLabel: { color: '#d1d5db', fontSize: 11, marginTop: 6 },
});
