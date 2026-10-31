import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageProps, StyleSheet, View } from 'react-native';
import { attachmentUrl } from '../../api/attachments';
import { getValidAccessToken } from '../../api/client';
import { useTheme } from '../../theme/ThemeContext';

type Props = Omit<ImageProps, 'source'> & { attachmentId: string };

// Dosya uç noktası token ister; Image'a adresle birlikte Authorization başlığını veririz.
// Token kısa ömürlü olduğu için her gösterimde geçerli olanı alırız (gerekirse yenilenir).
export default function AuthorizedImage({ attachmentId, style, ...rest }: Props) {
  const { colors } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getValidAccessToken()
      .then((t) => active && setToken(t))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [attachmentId]);

  return (
    <View style={[styles.box, style]}>
      {token && !failed && (
        <Image
          {...rest}
          source={{ uri: attachmentUrl(attachmentId), headers: { Authorization: `Bearer ${token}` } }}
          style={StyleSheet.absoluteFill}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {failed ? (
        <Ionicons name="image-outline" size={32} color={colors.textMuted} />
      ) : (
        !loaded && <ActivityIndicator color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
