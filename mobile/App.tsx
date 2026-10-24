import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AuthStackParamList, RootStackParamList } from './src/navigation/types';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RoomDetailScreen from './src/screens/RoomDetailScreen';
import RoomFormScreen from './src/screens/RoomFormScreen';
import RoomLiveScreen from './src/screens/RoomLiveScreen';
import RoomsScreen from './src/screens/RoomsScreen';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function RootNavigator() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return user ? (
    <AppStack.Navigator>
      <AppStack.Screen
        name="Rooms"
        component={RoomsScreen}
        options={{
          title: 'Ekip Odaları',
          headerRight: () => (
            <Pressable onPress={logout}>
              <Text style={{ color: '#dc2626', fontWeight: '600' }}>Çıkış</Text>
            </Pressable>
          ),
        }}
      />
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