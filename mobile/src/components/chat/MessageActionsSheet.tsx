import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../../theme/colors';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';

type Props = { visible: boolean; onClose: () => void; onDelete: () => void };

// Kendi mesajına uzun basınca alttan açılan menü. Şimdilik tek işlem: herkes için sil.
export default function MessageActionsSheet({ visible, onClose, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => {
            onClose();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <Text style={styles.deleteText}>Sil</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
          <Text style={styles.cancelText}>Vazgeç</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.backdrop },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
    pressed: { backgroundColor: c.surfaceMuted },
    deleteText: { fontSize: 16, fontWeight: '600', color: c.danger },
    cancelText: { fontSize: 16, color: c.text },
  });
