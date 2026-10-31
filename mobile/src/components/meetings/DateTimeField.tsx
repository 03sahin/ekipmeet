import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import { formatClock, formatLongDate } from '../../utils/date';

type Props = { value: Date; onChange: (date: Date) => void; minimumDate?: Date };

// Tarih ve saat ayrı ayrı seçilir; seçilen değer cihazın yerel saatindedir (gönderirken toISOString UTC'ye çevirir)
export default function DateTimeField({ value, onChange, minimumDate }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Android: sistemin açılır penceresi. "Tamam"a basınca type === 'set' gelir, "İptal"de değişiklik yok.
  // Pencerenin açık/koyu hâli uygulamanın temasını izler (ThemeProvider bunu native tarafa iletir).
  function openAndroid(mode: 'date' | 'time') {
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      minimumDate: mode === 'date' ? minimumDate : undefined,
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type === 'set' && date) onChange(merge(value, date, mode));
      },
    });
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          locale="tr-TR"
          accentColor={colors.meetings.text}
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_, d) => d && onChange(merge(value, d, 'date'))}
        />
        <DateTimePicker
          value={value}
          mode="time"
          display="compact"
          locale="tr-TR"
          accentColor={colors.meetings.text}
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={(_, d) => d && onChange(merge(value, d, 'time'))}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable style={[styles.field, styles.dateField]} onPress={() => openAndroid('date')}>
        <Ionicons name="calendar-outline" size={18} color={colors.meetings.text} />
        <Text style={styles.fieldText}>{formatLongDate(value)}</Text>
      </Pressable>
      <Pressable style={styles.field} onPress={() => openAndroid('time')}>
        <Ionicons name="time-outline" size={18} color={colors.meetings.text} />
        <Text style={styles.fieldText}>{formatClock(value)}</Text>
      </Pressable>
    </View>
  );
}

// Tarih seçilince saat korunur, saat seçilince tarih korunur
function merge(current: Date, picked: Date, mode: 'date' | 'time'): Date {
  const result = new Date(current);
  if (mode === 'date') result.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  else result.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return result;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    iosRow: { flexDirection: 'row', gap: 8 },
    row: { flexDirection: 'row', gap: 8 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.meetings.border,
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    dateField: { flex: 1 },
    fieldText: { fontSize: 15, color: c.text },
  });
