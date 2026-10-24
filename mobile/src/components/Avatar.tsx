import { StyleSheet, Text, View } from 'react-native';

const COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];

// Aynı isim her zaman aynı rengi alsın diye isimden basit bir sayı üretiyoruz
function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('tr-TR');
}

type AvatarProps = { name: string; size?: number; isGroup?: boolean };

export default function Avatar({ name, size = 48, isGroup }: AvatarProps) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(name) }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{isGroup ? '👥' : initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
