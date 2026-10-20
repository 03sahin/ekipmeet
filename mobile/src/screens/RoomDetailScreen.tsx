import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { rooms } from '../data/rooms';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomDetail'>;

export default function RoomDetailScreen({ route }: Props) {
  // Önceki ekrandan gelen parametre
  const { roomId } = route.params;
  const room = rooms.find((r) => r.id === roomId);

  // Oda bulunamazsa uygulama çökmesin
  if (!room) {
    return (
      <View style={styles.container}>
        <Text style={styles.topic}>Oda bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{room.name}</Text>
      <Text style={styles.topic}>{room.topic}</Text>
      <Text style={styles.members}>{room.memberCount} kişi içeride</Text>

      <Pressable
        style={styles.button}
        onPress={() => Alert.alert('Yakında', 'Odaya katılma Aşama 5\'te gelecek.')}
      >
        <Text style={styles.buttonText}>Odaya katıl</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  name: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  topic: { fontSize: 16, color: '#6b7280', marginTop: 8 },
  members: { fontSize: 15, color: '#2563eb', marginTop: 16 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});