import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchUsers } from '../api/chat';
import { getErrorMessage } from '../api/errors';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { UserSummary } from '../types/chat';
import Avatar from './Avatar';

type UserSearchProps = {
  onSelect: (user: UserSummary) => void;
  selectedIds?: string[]; // Seçilenlerin yanında ✓ görünür (grup oluşturma)
  excludeIds?: string[]; // Listede hiç gösterilmeyenler (zaten grupta olanlar)
  placeholder?: string;
  autoFocus?: boolean;
};

// Arama kutusu + sonuçlar. Sonuçlar en fazla 20 olduğu için FlatList yerine map yeterli;
// böylece bileşen ScrollView içine sorunsuz konabiliyor.
export default function UserSearch({ onSelect, selectedIds = [], excludeIds = [], placeholder, autoFocus }: UserSearchProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ekranda hemen değişecek durumlar yazarken ayarlanır; effect sadece aramayı yapar
  function changeQuery(text: string) {
    setQuery(text);
    const short = text.trim().length < 2;
    if (short) {
      setResults([]);
      setError(null);
    }
    setLoading(!short);
  }

  // Debounce: her harfte değil, yazmayı 300 ms bırakınca ara
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    let cancelled = false; // Eski bir aramanın cevabı yenisinin üstüne yazmasın
    const timer = setTimeout(() => {
      searchUsers(q)
        .then((users) => {
          if (!cancelled) {
            setResults(users);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(getErrorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const visible = results.filter((u) => !excludeIds.includes(u.id));
  const q = query.trim();

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={changeQuery}
        placeholder={placeholder ?? 'İsimle ara...'}
        placeholderTextColor={colors.placeholder}
        autoFocus={autoFocus}
        autoCorrect={false}
      />

      {loading && <ActivityIndicator style={styles.status} color={colors.chats.text} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && q.length > 0 && q.length < 2 && <Text style={styles.hint}>En az 2 harf yaz.</Text>}
      {!loading && !error && q.length >= 2 && visible.length === 0 && <Text style={styles.hint}>Kimse bulunamadı.</Text>}

      {visible.map((u) => {
        const selected = selectedIds.includes(u.id);
        return (
          <Pressable
            key={u.id}
            onPress={() => onSelect(u)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Avatar name={u.displayName} size={40} />
            <Text style={styles.name}>{u.displayName}</Text>
            {selected && <Text style={styles.check}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
    },
    status: { marginTop: 12 },
    error: { color: c.danger, marginTop: 12 },
    hint: { color: c.textTertiary, marginTop: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    pressed: { opacity: 0.6 },
    name: { flex: 1, fontSize: 16, color: c.text },
    check: { fontSize: 18, color: c.chats.text, fontWeight: '700' },
  });
