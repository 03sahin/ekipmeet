import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import NotificationBell from './src/components/NotificationBell';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthStackParamList, RootStackParamList, TabParamList } from './src/navigation/types';
import { NotificationsProvider } from './src/notifications/NotificationsContext';
import CallScreen from './src/screens/CallScreen';
import ChatScreen from './src/screens/ChatScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import GroupInfoScreen from './src/screens/GroupInfoScreen';
import ImageViewerScreen from './src/screens/ImageViewerScreen';
import InstantMeetingScreen from './src/screens/InstantMeetingScreen';
import LoginScreen from './src/screens/LoginScreen';
import MeetingDetailScreen from './src/screens/MeetingDetailScreen';
import MeetingFormScreen from './src/screens/MeetingFormScreen';
import MeetingsScreen from './src/screens/MeetingsScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RoomDetailScreen from './src/screens/RoomDetailScreen';
import RoomFormScreen from './src/screens/RoomFormScreen';
import RoomLiveScreen from './src/screens/RoomLiveScreen';
import RoomsScreen from './src/screens/RoomsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

// Tema seçimi ve çıkış Ayarlar ekranında
function SettingsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => navigation.navigate('Settings')}
      style={{ marginRight: 16 }}
      hitSlop={8}
      accessibilityLabel="Ayarlar"
    >
      <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
    </Pressable>
  );
}

function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <NotificationBell />
      <SettingsButton />
    </View>
  );
}

// Alt sekmeler: her sekmenin kendi üst çubuğu var; zil ve ayarlar butonu hepsinde
function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tabs.Navigator screenOptions={{ headerRight: () => <HeaderActions /> }}>
      <Tabs.Screen
        name="Rooms"
        component={RoomsScreen}
        options={{
          title: 'Ekip Odaları',
          tabBarLabel: 'Odalar',
          tabBarActiveTintColor: colors.rooms.text,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{
          title: 'Sohbetler',
          tabBarActiveTintColor: colors.chats.text,
          tabBarBadgeStyle: { backgroundColor: colors.chats.solid, color: colors.onAccent },
          lazy: false, // Sekmeye hiç girilmese de okunmamış rozeti canlı güncellensin
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Meetings"
        component={MeetingsScreen}
        options={{
          title: 'Toplantılar',
          tabBarActiveTintColor: colors.meetings.text,
          tabBarBadgeStyle: { backgroundColor: colors.meetings.solid, color: colors.onAccent },
          lazy: false, // Yanıt bekleyen davet rozeti sekmeye girmeden de görünsün
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.rooms.text} />
      </View>
    );
  }

  return user ? (
    <AppStack.Navigator>
      {/* Sekmeler stack'in en altında; diğer ekranlar üstüne açılır ve alt çubuğu gizler */}
      <AppStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <AppStack.Screen name="RoomDetail" component={RoomDetailScreen} options={{ title: '' }} />
      <AppStack.Screen
        name="RoomForm"
        component={RoomFormScreen}
        // Başlık, düzenleme mi yeni oda mı olduğuna göre değişir
        options={({ route }) => ({ title: route.params?.roomId ? 'Odayı Düzenle' : 'Yeni Oda' })}
      />
      <AppStack.Screen
        name="RoomLive"
        component={RoomLiveScreen}
        options={({ route }) => ({ title: route.params.roomName })}
      />
      <AppStack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <AppStack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Yeni Sohbet' }} />
      <AppStack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: 'Grup Bilgisi' }} />
      <AppStack.Screen name="MeetingDetail" component={MeetingDetailScreen} options={{ title: 'Toplantı' }} />
      <AppStack.Screen name="MeetingForm" component={MeetingFormScreen} options={{ title: 'Toplantı Planla' }} />
      <AppStack.Screen name="InstantMeeting" component={InstantMeetingScreen} options={{ title: 'Hızlı Toplantı' }} />
      {/* Görüşme kendi üst çubuğunu çizer; koyu tam ekran */}
      <AppStack.Screen
        name="Call"
        component={CallScreen}
        options={{ headerShown: false, statusBarStyle: 'light', gestureEnabled: false }}
      />
      <AppStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ headerShown: false, statusBarStyle: 'light', animation: 'fade' }}
      />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Bildirimler' }} />
      <AppStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
    </AppStack.Navigator>
  ) : (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// Başlık/sekme çubuğu (React Navigation teması) ve durum çubuğu seçili temayı izler
function ThemedApp() {
  const { isDark, navigationTheme } = useTheme();
  return (
    <AuthProvider>
      {/* Bildirimler navigasyonun dışında: banner her ekranın üstünde, dokununca navigationRef ile gidilir */}
      <NotificationsProvider>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
      </NotificationsProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
