import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { getErrorMessage } from '../api/errors';
import { getMeetingsInRange, getUpcomingMeetings } from '../api/meetings';
import '../components/meetings/calendarLocale';
import MeetingListItem from '../components/meetings/MeetingListItem';

import { RootStackParamList, TabParamList } from '../navigation/types';
import { connectRoomHub, onHubEvent, onReconnected } from '../realtime/roomHub';
import { ThemeColors } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { MeetingSummary } from '../types/meeting';
import { formatDayHeading, formatLongDate, fromDateKey, toDateKey } from '../utils/date';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Meetings'>,
  NativeStackScreenProps<RootStackParamList>
>;

type View_ = 'calendar' | 'upcoming';

const MEETING_EVENTS = ['MeetingInvited', 'MeetingChanged', 'MeetingCancelled', 'MeetingRemoved'];

// Görünen ayın biraz öncesi ve sonrası da gelsin: takvim ızgarası komşu ayların günlerini de gösterir
function monthRange(monthKey: string): [Date, Date] {
  const first = fromDateKey(monthKey);
  const from = new Date(first.getFullYear(), first.getMonth(), 1 - 7);
  const to = new Date(first.getFullYear(), first.getMonth() + 1, 1 + 7);
  return [from, to];
}

export default function MeetingsScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const today = toDateKey(new Date());
  const [view, setView] = useState<View_>('calendar');
  const [selectedDay, setSelectedDay] = useState(today);
  const [monthMeetings, setMonthMeetings] = useState<MeetingSummary[]>([]);
  const [upcoming, setUpcoming] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now()); // "Şu an sürüyor" şeridi için; dakikada bir güncellenir

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Olay dinleyicileri hangi ayın açık olduğunu bilsin diye ref (state closure'da eski kalırdı)
  const monthRef = useRef(today.slice(0, 8) + '01');

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [from, to] = monthRange(monthRef.current);
      const [inMonth, next] = await Promise.all([getMeetingsInRange(from, to), getUpcomingMeetings()]);
      setMonthMeetings(inMonth);
      setUpcoming(next);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  // Davet, değişiklik, iptal, çıkarılma: hepsinde takvimi yeniden çek
  useEffect(() => {
    const offs = MEETING_EVENTS.map((event) => onHubEvent(event, () => reload()));
    const offReconnected = onReconnected(reload);
    connectRoomHub().catch(() => {});
    return () => {
      offs.forEach((off) => off());
      offReconnected();
    };
  }, [reload]);

  // Sekme rozetinde yanıt bekleyen davet sayısı
  useEffect(() => {
    const pending = upcoming.filter((m) => !m.isOrganizer && m.myResponse === 'Pending').length;
    navigation.setOptions({ tabBarBadge: pending > 0 ? pending : undefined });
  }, [upcoming, navigation]);

  // Toplantı olan günlere nokta; seçili gün dolu daire
  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const m of monthMeetings) {
      const key = toDateKey(new Date(m.startsAt));
      const active = m.status !== 'Cancelled';
      // Aynı günde hem iptal hem aktif varsa nokta turuncu kalsın
      if (!marks[key] || active) marks[key] = { marked: true, dotColor: active ? colors.meetings.text : colors.textMuted };
    }
    marks[selectedDay] = { ...marks[selectedDay], selected: true, selectedColor: colors.meetings.solid };
    return marks;
  }, [monthMeetings, selectedDay, colors]);

  const dayMeetings = useMemo(
    () => monthMeetings.filter((m) => toDateKey(new Date(m.startsAt)) === selectedDay),
    [monthMeetings, selectedDay]
  );

  // "Yaklaşan" görünümü: güne göre gruplu
  const upcomingSections = useMemo(() => {
    const groups = new Map<string, MeetingSummary[]>();
    for (const m of upcoming) {
      const key = toDateKey(new Date(m.startsAt));
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return [...groups.entries()].map(([key, data]) => ({ title: formatDayHeading(fromDateKey(key)), data }));
  }, [upcoming]);

  const openMeeting = (m: MeetingSummary) => navigation.navigate('MeetingDetail', { meetingId: m.id });
  const onRefresh = () => {
    setRefreshing(true);
    reload();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.meetings.text} />
      </View>
    );
  }

  const switcher = (
    <View style={styles.switcher}>
      {(['calendar', 'upcoming'] as const).map((v) => (
        <Pressable key={v} style={[styles.switchItem, view === v && styles.switchActive]} onPress={() => setView(v)}>
          <Ionicons
            name={v === 'calendar' ? 'calendar-outline' : 'list-outline'}
            size={16}
            color={view === v ? colors.onAccent : colors.meetings.onSoft}
          />
          <Text style={[styles.switchText, view === v && styles.switchTextActive]}>
            {v === 'calendar' ? 'Takvim' : `Yaklaşan (${upcoming.length})`}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {view === 'calendar' ? (
        <FlatList
          data={dayMeetings}
          keyExtractor={(m) => m.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {switcher}
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.calendarCard}>
                <Calendar
                  key={isDark ? 'dark' : 'light'} // Takvim temayı ilk açılışta okur; tema değişince yeniden kurulsun
                  current={selectedDay}
                  firstDay={1} // Hafta pazartesi başlasın
                  markedDates={markedDates}
                  onDayPress={(d: DateData) => setSelectedDay(d.dateString)}
                  onMonthChange={(d: DateData) => {
                    monthRef.current = `${d.dateString.slice(0, 8)}01`;
                    reload();
                  }}
                  enableSwipeMonths
                  theme={{
                    calendarBackground: colors.surface,
                    monthTextColor: colors.text,
                    dayTextColor: colors.text,
                    textDisabledColor: colors.textMuted,
                    textSectionTitleColor: colors.textTertiary,
                    todayTextColor: colors.meetings.text,
                    arrowColor: colors.meetings.text,
                    selectedDayBackgroundColor: colors.meetings.solid,
                    selectedDayTextColor: colors.onAccent,
                    dotColor: colors.meetings.text,
                    selectedDotColor: colors.onAccent,
                    textMonthFontWeight: '700',
                    textDayHeaderFontWeight: '600',
                  }}
                />
              </View>
              <Text style={styles.dayTitle}>
                {formatLongDate(fromDateKey(selectedDay))}
                {dayMeetings.length > 0 ? ` · ${dayMeetings.length} toplantı` : ''}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyDay}>
              <Text style={styles.empty}>Bu gün için toplantı yok.</Text>
              {selectedDay >= today && (
                <Pressable onPress={() => navigation.navigate('MeetingForm', { date: selectedDay })}>
                  <Text style={styles.link}>Bu güne toplantı planla</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => <MeetingListItem meeting={item} now={now} onPress={() => openMeeting(item)} />}
        />
      ) : (
        <SectionList
          sections={upcomingSections}
          keyExtractor={(m) => m.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <>
              {switcher}
              {error && <Text style={styles.error}>{error}</Text>}
            </>
          }
          ListEmptyComponent={<Text style={styles.empty}>Yaklaşan toplantın yok.</Text>}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => <MeetingListItem meeting={item} now={now} onPress={() => openMeeting(item)} />}
        />
      )}

      {/* İki eylem: planlı toplantı (seçili güne) ve hemen başlayan hızlı toplantı */}
      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.actionSecondary]} onPress={() => navigation.navigate('InstantMeeting')}>
          <Ionicons name="flash" size={18} color={colors.meetings.text} />
          <Text style={styles.actionSecondaryText}>Hızlı toplantı</Text>
        </Pressable>
        <Pressable
          style={[styles.action, styles.actionPrimary]}
          onPress={() =>
            navigation.navigate('MeetingForm', view === 'calendar' && selectedDay >= today ? { date: selectedDay } : {})
          }
        >
          <Ionicons name="calendar" size={18} color="#fff" />
          <Text style={styles.actionPrimaryText}>Toplantı planla</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.meetings.faint },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16, paddingBottom: 150 }, // Alttaki iki buton listeyi kapatmasın
    error: { color: c.danger, marginBottom: 12 },
    switcher: {
      flexDirection: 'row',
      backgroundColor: c.meetings.soft,
      borderRadius: 999,
      padding: 4,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.meetings.border,
    },
    switchItem: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 999,
    },
    switchActive: { backgroundColor: c.meetings.solid },
    switchText: { color: c.meetings.onSoft, fontWeight: '600' },
    switchTextActive: { color: c.onAccent },
    calendarCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.meetings.border,
      paddingBottom: 8,
    },
    dayTitle: { fontSize: 15, fontWeight: '700', color: c.meetings.onSoft, marginTop: 16, marginBottom: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.meetings.onSoft, marginTop: 8, marginBottom: 8 },
    emptyDay: { alignItems: 'center', marginTop: 16, gap: 8 },
    empty: { color: c.textTertiary, textAlign: 'center', marginTop: 16 },
    link: { color: c.meetings.text, fontWeight: '600' },
    actions: { position: 'absolute', right: 16, bottom: 20, alignItems: 'flex-end', gap: 10 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 999,
      elevation: 4,
    },
    actionPrimary: { backgroundColor: c.meetings.solid },
    actionPrimaryText: { color: c.onAccent, fontWeight: '700', fontSize: 15 },
    actionSecondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.meetings.text },
    actionSecondaryText: { color: c.meetings.text, fontWeight: '700', fontSize: 15 },
  });
