import { StyleSheet } from 'react-native';

// Giriş ve kayıt ekranlarının ortak stilleri
export const authStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#2563eb', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 20, fontSize: 15 },
});