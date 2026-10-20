import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, View } from 'react-native';
import RoomCard from '../components/RoomCard';
import { rooms } from '../data/rooms';
import { RootStackParamList } from '../navigation/types';

// Bu ekranın props türü: navigation ve route nesnelerini otomatik alır.
type Props = NativeStackScreenProps<RootStackParamList, 'Rooms'>;

export default function RoomsScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RoomCard
            name={item.name}
            topic={item.topic}
            memberCount={item.memberCount}
            // Detay ekranına git ve oda kimliğini parametre olarak gönder
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
});