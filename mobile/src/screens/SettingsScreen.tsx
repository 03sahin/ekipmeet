import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import { ThemeColors } from '../theme/colors';
import { ThemePreference, useTheme, useThemedStyles } from '../theme/ThemeContext';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { value: 'system', label: 'Sistem', hint: 'Telefonun açık/koyu ayarını izler', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Açık', icon: 'sunny-outline' },
  { value: 'dark', label: 'Koyu', icon: 'moon-outline' },
];

// Görünüm tercihi ve hesaptan çıkış
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(makeStyles);

  function confirmLogout() {
    Alert.alert('Çıkış yap', 'Hesabından çıkmak istiyor musun?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {user && (
        <View style={styles.profile}>
          <Avatar name={user.displayName} size={56} />
          <View style={styles.profileText}>
            <Text style={styles.name}>{user.displayName}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Görünüm</Text>
      <View style={styles.card}>
        {THEME_OPTIONS.map((o, i) => {
          const selected = preference === o.value;
          return (
            <Pressable
              key={o.value}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}
              onPress={() => setPreference(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Ionicons name={o.icon} size={22} color={selected ? colors.rooms.text : colors.textSecondary} />
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{o.label}</Text>
                {o.hint && <Text style={styles.rowHint}>{o.hint}</Text>}
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? colors.rooms.text : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Hesap</Text>
      <View style={styles.card}>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, paddingBottom: 32 },
    profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
    profileText: { flex: 1 },
    name: { fontSize: 18, fontWeight: '700', color: c.text },
    email: { fontSize: 14, color: c.textTertiary, marginTop: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textTertiary, marginTop: 20, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pressed: { backgroundColor: c.surfaceMuted },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 16, color: c.text },
    rowLabelSelected: { fontWeight: '600' },
    rowHint: { fontSize: 13, color: c.textTertiary, marginTop: 2 },
    logoutText: { flex: 1, fontSize: 16, color: c.danger, fontWeight: '600' },
  });
