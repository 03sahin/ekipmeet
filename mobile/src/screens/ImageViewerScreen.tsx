import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthorizedImage from '../components/chat/AuthorizedImage';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageViewer'>;

// Sohbetteki fotoğrafın tam ekran hâli
export default function ImageViewerScreen({ route, navigation }: Props) {
  const { attachmentId, name } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AuthorizedImage attachmentId={attachmentId} style={styles.image} resizeMode="contain" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1 },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  name: { flex: 1, color: '#fff', fontSize: 15 },
});
