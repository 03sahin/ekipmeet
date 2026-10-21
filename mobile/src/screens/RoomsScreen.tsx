import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import RoomCard from '../components/RoomCard';
import { rooms } from '../data/rooms';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Rooms'>;

export default function RoomsScreen({ navigation }: Props) {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        // Listenin en üstüne eklenen içerik
        ListHeaderComponent={<Text style={styles.greeting}>Merhaba, {user?.displayName} 👋</Text>}
        renderItem={({ item }) => (
          <RoomCard
            name={item.name}
            topic={item.topic}
            memberCount={item.memberCount}
            onPress={() => navigation.navigate('RoomDetail', { roomId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  listContent: { padding: 16 },
  greeting: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
});