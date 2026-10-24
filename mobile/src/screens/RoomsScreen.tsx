import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '../api/errors';
import { getRooms } from '../api/rooms';
import { useAuth } from '../auth/AuthContext';
import RoomCard from '../components/RoomCard';
import { RootStackParamList } from '../navigation/types';
import { connectRoomHub, onHubEvent, onReconnected } from '../realtime/roomHub';
import { Room } from '../types/room';

type Props = NativeStackScreenProps<RootStackParamList, 'Rooms'>;

export default function RoomsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRooms(await getRooms());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Ekran her göründüğünde (oda ekleyip/silip geri dönünce de) listeyi yenile
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Canlı kişi sayısı: biri bir odaya girip çıktıkça sunucu herkese yeni sayıyı yollar
  useEffect(() => {
    const offCount = onHubEvent('RoomCountChanged', (roomId: number, count: number) => {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, memberCount: count } : r)));
    });
    const offReconnected = onReconnected(load); // Kopukken kaçırdığımız değişiklikleri al
    connectRoomHub().catch(() => {}); // Bağlanamazsa liste yine çalışır, sadece sayı canlı olmaz
    return () => {
      offCount();
      offReconnected();
    };
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true); // Aşağı çekince yenile
          load();
        }}
        ListHeaderComponent={
          <>
            <Text style={styles.greeting}>Merhaba, {user?.displayName} 👋</Text>
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        }
        ListEmptyComponent={
          !error ? <Text style={styles.empty}>Henüz oda yok. Sağ alttaki + ile ilk odanı oluştur.</Text> : null
        }
        renderItem={({ item }) => (
          <RoomCard
            name={item.name}
            topic={item.topic}
            ownerName={item.ownerName}
            isOwner={item.isOwner}
            memberCount={item.memberCount}
            onPress={() => navigation.navigate('RoomDetail', { roomId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
      />

      {/* Yüzen ekleme butonu (FAB) */}
      <Pressable style={styles.fab} onPress={() => navigation.navigate('RoomForm', {})}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 96 },
  greeting: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
  error: { color: '#dc2626', marginBottom: 12 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 48, fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4, // Android gölgesi
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 34 },
});