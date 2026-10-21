import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getErrorMessage } from '../api/errors';
import { createRoom, getRoom, updateRoom } from '../api/rooms';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomForm'>;

export default function RoomFormScreen({ route, navigation }: Props) {
  const roomId = route.params?.roomId;
  const isEdit = roomId !== undefined;

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(isEdit); // Düzenlemede önce mevcut veriyi yükle
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    getRoom(roomId)
      .then((room) => {
        setName(room.name);
        setTopic(room.topic);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [isEdit, roomId]);

  async function handleSave() {
    if (!name.trim()) {
      setError('Oda adı zorunlu.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const input = { name: name.trim(), topic: topic.trim() };
      if (isEdit) await updateRoom(roomId, input);
      else await createRoom(input);
      navigation.goBack(); // Önceki ekran odaklanınca listeyi kendisi yeniler
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Oda adı</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Örn. Tasarım" maxLength={100} />

      <Text style={styles.label}>Açıklama (isteğe bağlı)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={topic}
        onChangeText={setTopic}
        placeholder="Bu oda ne için?"
        maxLength={300}
        multiline
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.button, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isEdit ? 'Kaydet' : 'Oluştur'}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: '#dc2626', marginBottom: 12 },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});