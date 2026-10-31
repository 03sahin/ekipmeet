import { DarkTheme, DefaultTheme, Theme as NavigationTheme } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'ekipmeet.themePreference';

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  navigationTheme: NavigationTheme; // Başlık ve sekme çubuğu bu renklerle çizilir
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Seçimi native tarafa da ilet: Alert, tarih seçici penceresi ve klavye de aynı temada açılsın
function applyToNative(preference: ThemePreference) {
  Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  // "Sistem" seçiliyken telefonun ayarı; değiştirilince uygulama yeniden açılmadan güncellenir
  const systemScheme = useColorScheme();

  // Kayıtlı tercihi bir kez oku (okunana kadar sistem teması görünür)
  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          applyToNative(saved);
          setPreferenceState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    applyToNative(next); // State'ten önce: "Sistem"e dönünce useColorScheme ilk render'da gerçek değeri versin
    setPreferenceState(next);
    SecureStore.setItemAsync(KEY, next).catch(() => {});
  }, []);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  // Kök görünümün zemini: klavye açılırken ya da ekran geçişlerinde arkada beyaz şerit görünmesin
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? darkColors.background : lightColors.background).catch(() => {});
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(() => {
    const colors = isDark ? darkColors : lightColors;
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      colors,
      isDark,
      preference,
      setPreference,
      navigationTheme: {
        ...base,
        colors: {
          ...base.colors,
          primary: colors.rooms.text,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.dangerSolid,
        },
      },
    };
  }, [isDark, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme, ThemeProvider içinde kullanılmalı');
  return context;
}

// Stiller renklere bağlı: tema değişince yeniden oluşur, değişmedikçe aynı nesne kullanılır.
// factory modül seviyesinde tanımlanmalı (her render'da yeni fonksiyon olmasın).
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
