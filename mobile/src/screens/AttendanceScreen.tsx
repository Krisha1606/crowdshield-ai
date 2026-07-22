import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import api from '../services/api';

export default function AttendanceScreen() {
  const [loading, setLoading] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00h 00m 00s');
  const [history, setHistory] = useState<any[]>([]);
  const [statusStr, setStatusStr] = useState('Not Checked In');
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const fetchAttendanceStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/status');
      setIsCheckedIn(res.data.is_checked_in);
      setCheckInTime(res.data.check_in_time);
      setStatusStr(res.data.status || 'Not Checked In');

      const histRes = await api.get('/attendance/history');
      setHistory(histRes.data || []);
    } catch (e: any) {
      console.error('[Attendance status fetch]', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceStatus();
  }, []);

  // Update timer ticks
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (statusStr === 'Working' && checkInTime) {
      const calculateElapsed = () => {
        const checkInDate = new Date(checkInTime.replace(/-/g, '/')); // safe parsing
        const diffMs = Math.max(0, new Date().getTime() - checkInDate.getTime());
        const secs = Math.floor(diffMs / 1000) % 60;
        const mins = Math.floor(diffMs / (1000 * 60)) % 60;
        const hrs = Math.floor(diffMs / (1000 * 60 * 60));

        const pad = (n: number) => n.toString().padStart(2, '0');
        setElapsedTime(`${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`);
      };

      calculateElapsed();
      interval = setInterval(calculateElapsed, 1000);
    } else {
      setElapsedTime('00h 00m 00s');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [statusStr, checkInTime]);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const res = await api.post('/attendance/check-in');
      Alert.alert('Checked In', 'Your duty shift timer has started.');
      setIsCheckedIn(true);
      setCheckInTime(res.data.check_in_time);
      setStatusStr('Working');
      await fetchAttendanceStatus(); // Refresh status and history
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to check in.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      await api.post('/attendance/check-out');
      Alert.alert('Checked Out', 'Your duty shift has ended. Working hours updated.');
      setIsCheckedIn(false);
      setCheckInTime(null);
      setStatusStr('Completed');
      await fetchAttendanceStatus(); // Refresh status and history
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to check out.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: any }) => (
    <GlassCard style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyDate}>{item.date}</Text>
        <Text style={styles.historyHours}>
          {item.stay_duration ? `${item.stay_duration} hrs` : '--'}
        </Text>
      </View>
      <Text style={styles.historyTime}>
        In: {item.check_in_time ? item.check_in_time.split(' ')[1] : '--'}  |  Out: {item.check_out_time ? item.check_out_time.split(' ')[1] : 'Active'}
      </Text>
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      <GlassCard style={styles.timerCard}>
        <Ionicons
          name="alarm-outline"
          size={48}
          color={statusStr === 'Working' ? colors.green : colors.textSecondary}
          style={styles.timerIcon}
        />
        <Text style={styles.statusText}>
          Shift Status: {statusStr === 'Working' ? 'ON DUTY' : statusStr === 'Completed' ? 'SHIFT COMPLETED' : 'OFF DUTY'}
        </Text>
        <Text style={styles.timerText}>{elapsedTime}</Text>

        {statusStr === 'Working' ? (
          <ActionButton
            title="🛑 Check Out / End Shift"
            variant="danger"
            onPress={handleCheckOut}
          />
        ) : statusStr === 'Completed' ? (
          <ActionButton
            title="✓ Shift Completed"
            variant="secondary"
            disabled={true}
            onPress={() => {}}
          />
        ) : (
          <ActionButton
            title="⏰ Check In / Start Shift"
            variant="primary"
            onPress={handleCheckIn}
          />
        )}
      </GlassCard>

      <Text style={styles.sectionHeader}>Attendance History</Text>
      {loading && history.length === 0 ? (
        <ActivityIndicator size="small" color={colors.blue} style={styles.loader} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.attendance_id?.toString() || item.date}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Duty Logs</Text>
              <Text style={styles.emptySubtitle}>
                No shift check-ins recorded in your history log database.
              </Text>
            </GlassCard>
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    padding: 16,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  timerIcon: {
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  historyCard: {
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  historyHours: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.blue,
  },
  historyTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  loader: {
    marginTop: 20,
  },
});
