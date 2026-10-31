import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthStackParamList } from '../navigation/types';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { makeAuthStyles } from './authStyles';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { colors } = useTheme();
  const s = useThemedStyles(makeAuthStyles);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    // Basit kontrolü cihazda da yapıyoruz; asıl kontrol yine backend'de
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalı.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sunucuya ulaşılamadı. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>EkipMeet</Text>
      <Text style={s.subtitle}>Yeni hesap oluştur</Text>

      <TextInput
        style={s.input}
        placeholder="Ad Soyad"
        placeholderTextColor={colors.placeholder}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={s.input}
        placeholder="E-posta"
        placeholderTextColor={colors.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="Şifre (en az 8 karakter)"
        placeholderTextColor={colors.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, loading && s.buttonDisabled]} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Kayıt ol</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.goBack()}>
        <Text style={s.link}>Zaten hesabın var mı? Giriş yap</Text>
      </Pressable>
    </View>
  );
}