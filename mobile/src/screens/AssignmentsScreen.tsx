import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { ActionButton } from '../components/ActionButton';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';

export default function AssignmentsScreen() {
  const { activeAssignment, notifications, setActiveAssignment, volunteerName } = useVolunteerStore();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const handleAccept = async () => {
    if (!activeAssignment) return;
    setLoading(true);
    try {
      await api.post(`/volunteers/requests/${activeAssignment.request_id}/accept`);
      Alert.alert('Request Accepted', 'You are now en route to the target gate.');
      // Refresh local copy
      setActiveAssignment({ ...activeAssignment, status: 'Accepted' });
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to accept redeployment.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleArrive = async () => {
    if (!activeAssignment) return;
    setLoading(true);
    try {
      await api.post(`/volunteers/requests/${activeAssignment.request_id}/arrive`);
      Alert.alert('Arrived at Gate', 'Arrival recorded. Preparing check-in scans.');
      setActiveAssignment(null); // Assignment completed
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to record arrival.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeAssignment) return;
    if (!reason.trim()) {
      Alert.alert('Validation Error', 'Please state a reason for rejection.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/volunteers/requests/${activeAssignment.request_id}/reject`, { reason });
      Alert.alert('Request Rejected', 'Redeployment rejected. Backup dispatches triggered.');
      setActiveAssignment(null);
      setReason('');
      setShowRejectForm(false);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to reject request.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderNotificationItem = ({ item }: { item: any }) => (
    <GlassCard style={styles.notifCard}>
      <View style={styles.notifHeader}>
        <StatusBadge status={item.severity || 'Info'} />
        <Text style={styles.notifTime}>
          {item.alert_time ? item.alert_time.split(' ')[1] : 'Just now'}
        </Text>
      </View>
      <Text style={styles.notifMsg}>{item.message}</Text>
      <Text style={styles.notifRec}>Rec: {item.recommendation}</Text>
    </GlassCard>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHeader}>Active AI Dispatch</Text>

      {activeAssignment ? (
        <GlassCard style={styles.assignmentCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.assignmentTitle}>Redeployment Request</Text>
              <Text style={styles.requestId}>Request #{activeAssignment.request_id}</Text>
            </View>
            <StatusBadge status={activeAssignment.status} />
          </View>

          <View style={styles.routeContainer}>
            <View style={styles.routeNode}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.routeText}>
                From:{' '}
                <Text style={styles.boldText}>
                  {activeAssignment.from_gate_name || 'Reserve Pool'}
                </Text>
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeNode}>
              <Ionicons name="pin-outline" size={18} color={colors.blue} />
              <Text style={styles.routeText}>
                To: <Text style={styles.boldText}>{activeAssignment.to_gate_name}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.metaContainer}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Volunteer Name:</Text>
              <Text style={styles.metaValue}>{volunteerName || 'Volunteer'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Priority Level:</Text>
              <Text style={[styles.metaValue, { fontWeight: 'bold', color: activeAssignment.priority === 'High' ? colors.red : activeAssignment.priority === 'Medium' ? colors.orange : colors.green }]}>
                {activeAssignment.priority || 'Medium'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Requested At:</Text>
              <Text style={styles.metaValue}>
                {activeAssignment.created_at ? activeAssignment.created_at.split(' ')[1] || activeAssignment.created_at : 'Just now'}
              </Text>
            </View>
          </View>

          <Text style={styles.reasonText}>Reason: {activeAssignment.reason}</Text>

          {loading ? (
            <ActivityIndicator size="small" color={colors.blue} style={styles.loader} />
          ) : (
            <View style={styles.actionGroup}>
              {activeAssignment.status === 'Pending' && (
                <>
                  {!showRejectForm ? (
                    <View style={styles.btnRow}>
                      <ActionButton
                        title="✓ Accept"
                        onPress={handleAccept}
                        style={styles.halfBtn}
                      />
                      <ActionButton
                        title="✕ Reject"
                        variant="secondary"
                        onPress={() => setShowRejectForm(true)}
                        style={styles.halfBtn}
                      />
                    </View>
                  ) : (
                    <View style={styles.rejectContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="State reason for rejection..."
                        placeholderTextColor={colors.textSecondary}
                        value={reason}
                        onChangeText={setReason}
                      />
                      <View style={styles.btnRow}>
                        <ActionButton
                          title="Submit Reject"
                          variant="danger"
                          onPress={handleReject}
                          style={styles.halfBtn}
                        />
                        <ActionButton
                          title="Cancel"
                          variant="secondary"
                          onPress={() => setShowRejectForm(false)}
                          style={styles.halfBtn}
                        />
                      </View>
                    </View>
                  )}
                </>
              )}

              {(activeAssignment.status === 'Accepted' || activeAssignment.status === 'En Route') && (
                <ActionButton title="📍 Confirm Arrival at Gate" onPress={handleArrive} />
              )}
            </View>
          )}
        </GlassCard>
      ) : (
        <GlassCard style={styles.emptyCard}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.green} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Stationed & Secure</Text>
          <Text style={styles.emptySubtitle}>
            No pending redeployment dispatches. You are currently stationed safely.
          </Text>
        </GlassCard>
      )}

      <Text style={[styles.sectionHeader, styles.spacing]}>Alerts & Incident Notifications</Text>
      <FlatList
        data={notifications}
        scrollEnabled={false} // Nested inside ScrollView
        keyExtractor={(item) => item.alert_id?.toString() || item.message}
        renderItem={renderNotificationItem}
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Feed Clear</Text>
            <Text style={styles.emptySubtitle}>
              There are no active emergency alerts or coordinator notifications.
            </Text>
          </GlassCard>
        }
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  spacing: {
    marginTop: 24,
  },
  assignmentCard: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  requestId: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  routeContainer: {
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.4)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: colors.navy === '#F5F6FA' ? 1 : 0,
    borderColor: colors.border,
  },
  routeNode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
    marginLeft: 8,
    marginVertical: 4,
  },
  routeText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 10,
  },
  boldText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  metaContainer: {
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy === '#F5F6FA' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  actionGroup: {
    marginTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfBtn: {
    flex: 0.48,
  },
  rejectContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: colors.textPrimary,
    marginBottom: 12,
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
  notifCard: {
    marginBottom: 10,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notifTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  notifMsg: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  notifRec: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  loader: {
    marginVertical: 10,
  },
});
