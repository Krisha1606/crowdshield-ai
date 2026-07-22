import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVolunteerStore } from '../store/useVolunteerStore';
import { useSyncMonitor } from '../hooks/useSyncMonitor';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { ActionButton } from '../components/ActionButton';
import { useThemeColors } from '../hooks/useThemeColors';
import api from '../services/api';

export default function HomeScreen({ navigation }: any) {
  // Activate background polling sync
  useSyncMonitor();
  const colors = useThemeColors();

  const {
    volunteerName,
    volunteerId,
    assignedGate,
    status,
    attendanceStatus,
    activeAssignment,
    notifications,
    systemMode,
    setStatus,
    theme,
    toggleTheme,
  } = useVolunteerStore();

  const styles = getStyles(colors);

  const [statusLoading, setStatusLoading] = useState(false);

  const changeStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      await api.post('/volunteers/my-status', { status: newStatus });
      setStatus(newStatus);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to update status.';
      Alert.alert('Status Error', msg);
    } finally {
      setStatusLoading(false);
    }
  };

  const triggerSOS = () => {
    Alert.alert(
      '🚨 SOS Emergency Trigger',
      'Confirm call to CrowdShield Security Dispatch center?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Dispatch', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
      ]
    );
  };

  const activeAlertsCount = notifications.filter((n) => n.status === 'Unread').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.welcome}>Welcome back,</Text>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 2.5,
              borderRadius: 6,
              backgroundColor: systemMode === 'Live' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              borderWidth: 1,
              borderColor: systemMode === 'Live' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(245, 158, 11, 0.3)',
            }}>
              <Text style={{
                fontSize: 8,
                fontWeight: 'bold',
                color: systemMode === 'Live' ? '#818cf8' : '#fbbf24',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>{systemMode} Mode</Text>
            </View>
          </View>
          <Text style={styles.name}>{volunteerName || 'Volunteer'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
            <Ionicons name={theme === 'light' ? 'moon-outline' : 'sunny-outline'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {activeAlertsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeAlertsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <GlassCard style={styles.kpiCard}>
        <View style={styles.kpiHeader}>
          <Text style={styles.kpiTitle}>Current Assignment</Text>
          <StatusBadge status={status} />
        </View>
        <Text style={styles.gateLabel}>
          Assigned Station:{' '}
          <Text style={styles.gateValue}>{assignedGate || 'Reserve Pool (Unassigned)'}</Text>
        </Text>
        <Text style={styles.gateLabel}>
          Attendance: <Text style={styles.gateValue}>
            {typeof attendanceStatus === 'object' && attendanceStatus !== null 
              ? attendanceStatus.status 
              : (attendanceStatus || 'Absent')}
          </Text>
        </Text>
      </GlassCard>

      <GlassCard style={styles.statusCard}>
        <Text style={styles.sectionHeader}>Change Duty Status</Text>
        <View style={styles.statusButtons}>
          <TouchableOpacity
            style={[styles.statusBtn, status === 'Available' && styles.statusActiveAvailable]}
            onPress={() => changeStatus('Available')}
            disabled={statusLoading}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={status === 'Available' ? '#fff' : colors.green} />
            <Text style={[styles.statusBtnText, status === 'Available' && styles.statusActiveText]}>Available</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusBtn, status === 'Break' && styles.statusActiveBreak]}
            onPress={() => changeStatus('Break')}
            disabled={statusLoading}
          >
            <Ionicons name="cafe-outline" size={20} color={status === 'Break' ? '#fff' : colors.orange} />
            <Text style={[styles.statusBtnText, status === 'Break' && styles.statusActiveText]}>Break</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      {activeAssignment && (
        <GlassCard style={styles.assignmentAlertCard}>
          <View style={styles.alertHeader}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.orange} />
            <Text style={styles.alertTitle}>New Dispatch Received</Text>
          </View>
          <Text style={styles.alertMessage}>
            AI has suggested redeployment from {activeAssignment.from_gate_name || 'Reserve'} to {activeAssignment.to_gate_name}.
          </Text>
          <ActionButton
            title="View Assignment"
            onPress={() => navigation.navigate('Assignments')}
            style={styles.alertBtn}
          />
        </GlassCard>
      )}

      <Text style={styles.actionsHeader}>Duty Tools</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => navigation.navigate('Attendance')}
        >
          <GlassCard style={styles.gridCard}>
            <Ionicons name="time-outline" size={32} color={colors.blue} />
            <Text style={styles.gridLabel}>Shift Clock</Text>
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => navigation.navigate('Checklist')}
        >
          <GlassCard style={styles.gridCard}>
            <Ionicons name="checkbox-outline" size={32} color={colors.blue} />
            <Text style={styles.gridLabel}>Safety Checklist</Text>
          </GlassCard>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => navigation.navigate('ReportIncident')}
        >
          <GlassCard style={styles.gridCard}>
            <Ionicons name="warning-outline" size={32} color={colors.blue} />
            <Text style={styles.gridLabel}>Report Incident</Text>
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => navigation.navigate('QR Verification')}
        >
          <GlassCard style={styles.gridCard}>
            <Ionicons name="qr-code-outline" size={32} color={colors.blue} />
            <Text style={styles.gridLabel}>QR Scanner</Text>
          </GlassCard>
        </TouchableOpacity>
      </View>

      <ActionButton
        title="🆘 SOS EMERGENCY DISPATCH"
        variant="danger"
        onPress={triggerSOS}
        style={styles.sosButton}
      />
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeToggle: {
    marginRight: 16,
    padding: 8,
  },
  welcome: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  bell: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: 4,
    top: 4,
    backgroundColor: colors.red,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  kpiCard: {
    marginBottom: 16,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  gateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  gateValue: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  statusCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusBtn: {
    flex: 0.48,
    flexDirection: 'row',
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBtnText: {
    marginLeft: 8,
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusActiveAvailable: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  statusActiveBreak: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  statusActiveText: {
    color: '#fff',
  },
  assignmentAlertCard: {
    borderColor: colors.orange,
    borderWidth: 1,
    marginBottom: 20,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    color: colors.orange,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  alertMessage: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  alertBtn: {
    height: 36,
  },
  actionsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridItem: {
    flex: 0.48,
  },
  gridCard: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  gridLabel: {
    marginTop: 10,
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  sosButton: {
    marginTop: 20,
  },
});
