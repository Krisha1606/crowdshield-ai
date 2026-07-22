import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import api from '../services/api';

export default function ChecklistScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [arrivedAtGate, setArrivedAtGate] = useState(false);
  const [qrScannerWorking, setQrScannerWorking] = useState(false);
  const [barricadesChecked, setBarricadesChecked] = useState(false);
  const [crowdFlowNormal, setCrowdFlowNormal] = useState(false);
  const [emergencyExitClear, setEmergencyExitClear] = useState(false);
  const [communicationDeviceChecked, setCommunicationDeviceChecked] = useState(false);
  const [shiftCompleted, setShiftCompleted] = useState(false);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/volunteers/checklist');
      if (res.data) {
        setArrivedAtGate(!!res.data.arrived_at_gate);
        setQrScannerWorking(!!res.data.qr_scanner_working);
        setBarricadesChecked(!!res.data.barricades_checked);
        setCrowdFlowNormal(!!res.data.crowd_flow_normal);
        setEmergencyExitClear(!!res.data.emergency_exit_clear);
        setCommunicationDeviceChecked(!!res.data.communication_device_checked);
        setShiftCompleted(!!res.data.shift_completed);
      }
    } catch (e) {
      console.warn('[Checklist Fetch Error] Failed to read checklist:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post('/volunteers/checklist', {
        arrived_at_gate: arrivedAtGate,
        qr_scanner_working: qrScannerWorking,
        barricades_checked: barricadesChecked,
        crowd_flow_normal: crowdFlowNormal,
        emergency_exit_clear: emergencyExitClear,
        communication_device_checked: communicationDeviceChecked,
        shift_completed: shiftCompleted,
      });

      Alert.alert('Checklist Submitted', 'Safety checklist updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to submit checklist.';
      Alert.alert('Submission Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const renderToggle = (label: string, value: boolean, onValueChange: (val: boolean) => void) => (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.navy === '#F5F6FA' ? '#cbd5e1' : '#475569', true: colors.blue }}
        thumbColor={value ? '#fff' : '#94a3b8'}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Loading checklist details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.instructions}>
        Complete the pre-duty safety inspections for your assigned gate. Submitted checklists are synchronized instantly with the Admin Dashboard.
      </Text>

      <GlassCard style={styles.formCard}>
        {renderToggle('Arrived at Assigned Gate', arrivedAtGate, setArrivedAtGate)}
        <View style={styles.divider} />
        {renderToggle('QR Ticket Scanners Inspected & Working', qrScannerWorking, setQrScannerWorking)}
        <View style={styles.divider} />
        {renderToggle('Safety Barricades Properly Arranged', barricadesChecked, setBarricadesChecked)}
        <View style={styles.divider} />
        {renderToggle('Crowd Flow Patterns Inspected', crowdFlowNormal, setCrowdFlowNormal)}
        <View style={styles.divider} />
        {renderToggle('Emergency Exit Gates Unlocked & Clear', emergencyExitClear, setEmergencyExitClear)}
        <View style={styles.divider} />
        {renderToggle('Communication Devices Inspected', communicationDeviceChecked, setCommunicationDeviceChecked)}
        <View style={styles.divider} />
        {renderToggle('Shift Operations Complete', shiftCompleted, setShiftCompleted)}
      </GlassCard>

      {saving ? (
        <ActivityIndicator size="large" color={colors.blue} style={styles.loader} />
      ) : (
        <ActionButton title="✓ Submit Checklist" onPress={handleSubmit} style={styles.submitBtn} />
      )}
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
  instructions: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  formCard: {
    paddingVertical: 10,
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 0.85,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  submitBtn: {
    marginTop: 10,
  },
  loader: {
    marginTop: 10,
  },
});
