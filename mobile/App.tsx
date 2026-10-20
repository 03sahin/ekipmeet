import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/navigation/types';
import RoomDetailScreen from './src/screens/RoomDetailScreen';
import RoomsScreen from './src/screens/RoomsScreen';

// Stack: ekranları üst üste dizen navigasyon (geri tuşu otomatik gelir)
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    // NavigationContainer: tüm navigasyonu saran ana kapsayıcı, uygulamada bir kez kullanılır
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Rooms" component={RoomsScreen} options={{ title: 'Ekip Odaları' }} />
        <Stack.Screen name="RoomDetail" component={RoomDetailScreen} options={{ title: 'Oda Detayı' }} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}