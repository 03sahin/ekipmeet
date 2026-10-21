import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthStackParamList } from '../navigation/types';
import { authStyles as s } from './authStyles';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // Başarılıysa user state'i dolar ve App otomatik Odalar ekranına geçer
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sunucuya ulaşılamadı. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>EkipMeet</Text>
      <Text style={s.subtitle}>Hesabına giriş yap</Text>

      <TextInput
        style={s.input}
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail} // Her tuşta state güncellenir (controlled input)
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="Şifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry // Şifreyi gizle
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, loading && s.buttonDisabled]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Giriş yap</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={s.link}>Hesabın yok mu? Kayıt ol</Text>
      </Pressable>
    </View>
  );
}