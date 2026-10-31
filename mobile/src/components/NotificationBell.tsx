import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { useNotifications } from '../notifications/NotificationsContext';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

// Üst çubuktaki zil: okunmamış bildirim sayısını rozetle gösterir
export default function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={8}
      style={styles.button}
      accessibilityLabel={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'}
    >
      <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.textSecondary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    button: { marginRight: 16 },
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: c.dangerSolid,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: { color: c.onAccent, fontSize: 11, fontWeight: '700' },
  });
