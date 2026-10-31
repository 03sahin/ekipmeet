import { StyleSheet } from 'react-native';
import { ThemeColors } from '../theme/colors';

// Giriş ve kayıt ekranlarının ortak stilleri
export const makeAuthStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.surface },
    title: { fontSize: 32, fontWeight: 'bold', color: c.rooms.text, textAlign: 'center' },
    subtitle: { fontSize: 16, color: c.textTertiary, textAlign: 'center', marginTop: 8, marginBottom: 32 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
      marginBottom: 12,
    },
    button: { backgroundColor: c.rooms.solid, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: c.onAccent, fontSize: 16, fontWeight: '600' },
    error: { color: c.danger, marginBottom: 8, textAlign: 'center' },
    link: { color: c.rooms.text, textAlign: 'center', marginTop: 20, fontSize: 15 },
  });