import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatFileSize, openAttachment } from '../../api/attachments';
import { AttachmentInfo } from '../../types/chat';

type IconName = ComponentProps<typeof Ionicons>['name'];

function iconFor(contentType: string): IconName {
  if (contentType === 'application/pdf') return 'document-text';
  if (contentType.includes('spreadsheet')) return 'grid';
  if (contentType.includes('presentation')) return 'easel';
  if (contentType === 'application/zip') return 'archive';
  return 'document';
}

// Belge eki: ad + boyut. Dokununca indirilir ve uygun bir uygulamayla açılır.
export default function AttachmentCard({ attachment }: { attachment: AttachmentInfo }) {
  const [opening, setOpening] = useState(false);

  async function open() {
    if (opening) return;
    setOpening(true);
    try {
      await openAttachment(attachment);
    } catch (e) {
      Alert.alert('Açılamadı', e instanceof Error ? e.message : 'Dosya açılamadı.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={open}>
      <View style={styles.icon}>
        {opening ? (
          <ActivityIndicator color="#16a34a" />
        ) : (
          <Ionicons name={iconFor(attachment.contentType)} size={24} color="#16a34a" />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {attachment.originalName}
        </Text>
        <Text style={styles.size}>{formatFileSize(attachment.sizeBytes)}</Text>
      </View>
      <Ionicons name="download-outline" size={20} color="#6b7280" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 10,
    minWidth: 220,
  },
  pressed: { opacity: 0.7 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  size: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
