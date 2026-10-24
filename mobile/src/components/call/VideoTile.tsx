import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { CallTile, Facing } from '../../call/CallSession';

const COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2'];

// Avatar'daki gibi: aynı isim hep aynı renk
function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

type Props = { tile: CallTile; width: number; height: number; facing: Facing };

export default function VideoTile({ tile, width, height, facing }: Props) {
  const showVideo = tile.videoEnabled && tile.streamURL !== null;
  const label = tile.isLocal ? `${tile.displayName} (sen)` : tile.displayName;
  const circle = Math.min(width, height) * 0.38;

  return (
    <View style={[styles.tile, { width, height }]}>
      <View style={styles.inner}>
        {showVideo ? (
          <RTCView
            streamURL={tile.streamURL!}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={tile.isLocal && facing === 'user'} // Ön kamerada kendimizi ayna gibi görürüz
            zOrder={0}
          />
        ) : (
          // Kamera kapalı ya da görüntü henüz gelmedi: adın baş harfi
          <View style={styles.placeholder}>
            <View
              style={[
                styles.initialCircle,
                { width: circle, height: circle, borderRadius: circle / 2, backgroundColor: colorFor(tile.displayName) },
              ]}
            >
              <Text style={[styles.initial, { fontSize: circle * 0.45 }]}>
                {(tile.displayName.trim()[0] ?? '?').toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
          </View>
        )}

        {tile.status !== 'connected' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {tile.status === 'failed' ? 'Bağlantı kurulamadı' : 'Bağlanıyor...'}
            </Text>
          </View>
        )}

        <View style={styles.nameBar}>
          {!tile.audioEnabled && <Ionicons name="mic-off" size={14} color="#f87171" />}
          <Text style={styles.name} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { padding: 3 },
  inner: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1f2937' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  initialCircle: { justifyContent: 'center', alignItems: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
  statusBadge: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  statusText: { color: '#e5e7eb', fontSize: 12 },
  nameBar: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  name: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
