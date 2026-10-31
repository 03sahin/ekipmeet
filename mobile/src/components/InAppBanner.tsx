import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/ThemeContext';

export type BannerContent = { key: string; title: string; body: string; icon: 'chatbubble' | 'calendar' | 'alarm' };

type Props = { content: BannerContent | null; onPress: () => void; onHide: () => void };

const VISIBLE_MS = 4000;

// Uygulama açıkken gelen bildirim: sistem bildirimi yerine üstten kayan kısa şerit
export default function InAppBanner({ content, onPress, onHide }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const [translateY] = useState(() => new Animated.Value(-150)); // Bir kez oluşturulan animasyon değeri

  useEffect(() => {
    if (!content) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(translateY, { toValue: -150, duration: 200, useNativeDriver: true }).start(onHide);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [content, translateY, onHide]);

  if (!content) return null;

  return (
    <Animated.View style={[styles.wrapper, { top: insets.top + 8, transform: [{ translateY }] }]}>
      <Pressable style={styles.banner} onPress={onPress}>
        <View style={styles.icon}>
          <Ionicons name={content.icon} size={20} color="#fff" />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {content.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {content.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrapper: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 10 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.banner,
      borderWidth: 1,
      borderColor: c.bannerBorder,
      borderRadius: 14,
      padding: 12,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.chats.solid,
      justifyContent: 'center',
      alignItems: 'center',
    },
    texts: { flex: 1 },
    title: { color: c.bannerTitle, fontWeight: '700', fontSize: 15 },
    body: { color: c.bannerBody, fontSize: 13, marginTop: 2 },
  });
