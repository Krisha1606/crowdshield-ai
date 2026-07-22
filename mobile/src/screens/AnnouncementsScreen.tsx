import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { ActionButton } from '../components/ActionButton';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ackLoading, setAckLoading] = useState<number | null>(null);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data || []);
    } catch (e) {
      console.warn('[Announcements fetch error]', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleAcknowledge = async (id: number) => {
    setAckLoading(id);
    try {
      await api.post(`/announcements/${id}/acknowledge`);
      Alert.alert('Announcement Acknowledged', 'Thank you for reviewing the notice.');
      // Refresh local list to update read statuses
      fetchAnnouncements();
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to acknowledge announcement.';
      Alert.alert('Error', msg);
    } finally {
      setAckLoading(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <GlassCard style={[styles.card, !item.is_read && styles.unreadBorder]}>
      <View style={styles.header}>
        <View style={styles.meta}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>
            {item.created_at ? item.created_at.split(' ')[0] : 'Today'}
          </Text>
        </View>
        <StatusBadge status={item.is_read ? 'Acknowledged' : 'Unread'} />
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={[styles.priority, { color: item.priority === 'High' ? colors.red : colors.textSecondary }]}>
        Priority: {item.priority || 'Normal'}
      </Text>

      {!item.is_read && (
        <View style={styles.btnRow}>
          {ackLoading === item.announcement_id ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <ActionButton
              title="✓ Mark as Read"
              onPress={() => handleAcknowledge(item.announcement_id)}
              style={styles.ackBtn}
            />
          )}
        </View>
      )}
    </GlassCard>
  );

  return (
    <View style={styles.container}>
      {loading && announcements.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.loadingText}>Fetching active announcements...</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.announcement_id?.toString() || item.title}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Bulletins</Text>
              <Text style={styles.emptySubtitle}>
                No official announcements have been posted by event coordinators yet.
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.navy,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    marginBottom: 16,
  },
  unreadBorder: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  meta: {
    flex: 0.7,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  time: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  message: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  priority: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  btnRow: {
    marginTop: 14,
    alignItems: 'flex-end',
  },
  ackBtn: {
    height: 34,
    width: 140,
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
});
