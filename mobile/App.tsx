import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AuthStackParamList, RootStackParamList, TabParamList } from './src/navigation/types';
import CallScreen from './src/screens/CallScreen';
import ChatScreen from './src/screens/ChatScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import GroupInfoScreen from './src/screens/GroupInfoScreen';
import InstantMeetingScreen from './src/screens/InstantMeetingScreen';
import LoginScreen from './src/screens/LoginScreen';
import MeetingDetailScreen from './src/screens/MeetingDetailScreen';
import MeetingFormScreen from './src/screens/MeetingFormScreen';
import MeetingsScreen from './src/screens/MeetingsScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RoomDetailScreen from './src/screens/RoomDetailScreen';
import RoomFormScreen from './src/screens/RoomFormScreen';
import RoomLiveScreen from './src/screens/RoomLiveScreen';
import RoomsScreen from './src/screens/RoomsScreen';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Pressable onPress={logout} style={{ marginRight: 16 }} hitSlop={8}>
      <Text style={{ color: '#dc2626', fontWeight: '600' }}>Çıkış</Text>
    </Pressable>
  );
}

// Alt sekmeler: her sekmenin kendi üst çubuğu var, çıkış butonu ikisinde de
function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerRight: () => <LogoutButton /> }}>
      <Tabs.Screen
        name="Rooms"
        component={RoomsScreen}
        options={{
          title: 'Ekip Odaları',
          tabBarLabel: 'Odalar',
          tabBarActiveTintColor: '#2563eb',
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
          tabBarActiveTintColor: '#16a34a',
          tabBarBadgeStyle: { backgroundColor: '#16a34a' },
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
          tabBarActiveTintColor: '#ea580c',
          tabBarBadgeStyle: { backgroundColor: '#ea580c' },
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
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
    </AppStack.Navigator>
  ) : (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
