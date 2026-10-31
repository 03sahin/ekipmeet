import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/ThemeContext';

export type AttachmentSource = 'gallery' | 'camera' | 'document';

type Props = { visible: boolean; onClose: () => void; onSelect: (source: AttachmentSource) => void };

const OPTIONS: { source: AttachmentSource; label: string; icon: ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { source: 'gallery', label: 'Galeriden fotoğraf', icon: 'images', color: '#7c3aed' },
  { source: 'camera', label: 'Kamerayla çek', icon: 'camera', color: '#db2777' },
  { source: 'document', label: 'Belge', icon: 'document-text', color: '#2563eb' },
];

// Ek butonuna basınca alttan açılan seçim menüsü (Android'de Alert en fazla 3 buton gösterir)
export default function AttachmentSheet({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.title}>Dosya gönder</Text>
        <View style={styles.row}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.source}
              style={styles.option}
              onPress={() => {
                onClose();
                onSelect(o.source);
              }}
            >
              <View style={[styles.circle, { backgroundColor: o.color }]}>
                <Ionicons name={o.icon} size={26} color="#fff" />
              </View>
              <Text style={styles.label}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>En fazla 10 MB · jpg, png, webp, heic, pdf, docx, xlsx, pptx, txt, zip</Text>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.backdrop },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
    title: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-around' },
    option: { alignItems: 'center', width: 100 },
    circle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    label: { marginTop: 8, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
    hint: { marginTop: 16, fontSize: 12, color: c.textMuted, textAlign: 'center' },
  });
