import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { getErrorMessage } from '../api/errors';
import { deleteRoom, getRoom } from '../api/rooms';
import { RootStackParamList } from '../navigation/types';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { Room } from '../types/room';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomDetail'>;

export default function RoomDetailScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Düzenleyip geri dönünce güncel bilgiyi göstermek için her odaklanmada yükle
  useFocusEffect(
    useCallback(() => {
      getRoom(roomId)
        .then(setRoom)
        .catch((e) => setError(getErrorMessage(e)));
    }, [roomId])
  );

  // Üst çubukta oda adını göster
  useLayoutEffect(() => {
    if (room) navigation.setOptions({ title: room.name });
  }, [room, navigation]);

  function confirmDelete() {
    if (!room) return;
    Alert.alert('Odayı sil', `"${room.name}" silinsin mi? Bu işlem geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoom(room.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Silinemedi', getErrorMessage(e));
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.rooms.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{room.name}</Text>
      {room.topic ? <Text style={styles.topic}>{room.topic}</Text> : null}
      <Text style={styles.meta}>Sahibi: {room.ownerName}</Text>
      <Text style={styles.meta}>Oluşturulma: {new Date(room.createdAt).toLocaleDateString('tr-TR')}</Text>
      <Text style={styles.meta}>Şu an içeride: {room.memberCount} kişi</Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate('RoomLive', { roomId: room.id, roomName: room.name })}
      >
        <Text style={styles.primaryText}>Odaya katıl</Text>
      </Pressable>

      {/* Butonlar sadece sahibe görünür. Asıl koruma backend'de; bu sadece arayüz kolaylığı. */}
      {room.isOwner && (
        <View style={styles.ownerActions}>
          <Pressable
            style={[styles.secondaryButton, styles.flex]}
            onPress={() => navigation.navigate('RoomForm', { roomId: room.id })}
          >
            <Text style={styles.secondaryText}>Düzenle</Text>
          </Pressable>
          <Pressable style={[styles.dangerButton, styles.flex]} onPress={confirmDelete}>
            <Text style={styles.dangerText}>Sil</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface, padding: 24 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    name: { fontSize: 28, fontWeight: 'bold', color: c.text },
    topic: { fontSize: 16, color: c.textSecondary, marginTop: 8 },
    meta: { fontSize: 14, color: c.textMuted, marginTop: 8 },
    error: { color: c.danger, fontSize: 16, textAlign: 'center' },
    primaryButton: { backgroundColor: c.rooms.solid, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 32 },
    primaryText: { color: c.onAccent, fontSize: 16, fontWeight: '600' },
    ownerActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    flex: { flex: 1 },
    secondaryButton: { borderWidth: 1, borderColor: c.rooms.text, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    secondaryText: { color: c.rooms.text, fontSize: 16, fontWeight: '600' },
    dangerButton: { borderWidth: 1, borderColor: c.danger, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    dangerText: { color: c.danger, fontSize: 16, fontWeight: '600' },
  });