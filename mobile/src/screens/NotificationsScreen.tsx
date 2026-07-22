import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';

export default function NotificationsScreen({ navigation }: any) {
  const { notifications, setSyncData, token } = useVolunteerStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filtering states
  const [filterType, setFilterType] = useState<string>('All');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await api.get('/volunteers/notifications');
      // Update store state partially while keeping other store keys intact
      useVolunteerStore.setState({ notifications: res.data || [] });
    } catch (e: any) {
      console.error('[NotificationsScreen fetch]', e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.post(`/volunteers/notifications/${id}/read`);
      // Update local state directly
      const updated = notifications.map((n) =>
        n.notification_id === id ? { ...n, status: 'Read' } : n
      );
      useVolunteerStore.setState({ notifications: updated });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await api.post('/volunteers/notifications/read-all');
      const updated = notifications.map((n) => ({ ...n, status: 'Read' }));
      useVolunteerStore.setState({ notifications: updated });
      Alert.alert('Success', 'All notifications marked as read.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to mark all notifications as read');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = (item: any) => {
    if (item.status === 'Unread') {
      handleMarkRead(item.notification_id);
    }
    
    // Navigate to related screen if applicable
    if (item.notification_type === 'Assignment' && item.related_id) {
      navigation.navigate('Assignments');
    }
  };

  // Filter list
  const filteredNotifications = notifications.filter((n) => {
    const matchesType = filterType === 'All' || n.notification_type === filterType;
    const matchesUnread = !unreadOnly || n.status === 'Unread';
    return matchesType && matchesUnread;
  });

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'Assignment':
        return { name: 'shield-outline' as const, color: colors.blue };
      case 'Announcement':
        return { name: 'megaphone-outline' as const, color: '#a855f7' }; // Purple
      case 'Alert':
        return { name: 'warning-outline' as const, color: colors.orange };
      case 'Attendance':
        return { name: 'time-outline' as const, color: colors.green };
      default:
        return { name: 'information-circle-outline' as const, color: colors.textSecondary };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const icon = getNotifIcon(item.notification_type);
    const isUnread = item.status === 'Unread';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleNotificationPress(item)}
        style={[styles.itemWrapper, isUnread && styles.unreadWrapper]}
      >
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconTitleRow}>
              <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
                <Ionicons name={icon.name} size={20} color={icon.color} />
              </View>
              <Text style={[styles.title, isUnread && styles.boldText]}>{item.title}</Text>
            </View>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.message}>{item.message}</Text>
          
          <View style={styles.cardFooter}>
            <Text style={styles.typeBadge}>{item.notification_type}</Text>
            <Text style={styles.timestamp}>
              {item.created_at ? item.created_at.split(' ')[1] || item.created_at : 'Just now'}
            </Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const filterOptions = ['All', 'Assignment', 'Announcement', 'Alert', 'Attendance'];

  return (
    <View style={styles.container}>
      {/* Top Filter Bar */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterOptions}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterTab, filterType === item && styles.activeFilterTab]}
              onPress={() => setFilterType(item)}
            >
              <Text style={[styles.filterTabText, filterType === item && styles.activeFilterTabText]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
        
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.unreadToggle}
            onPress={() => setUnreadOnly(!unreadOnly)}
          >
            <Ionicons
              name={unreadOnly ? 'checkbox' : 'square-outline'}
              size={18}
              color={unreadOnly ? colors.blue : colors.textSecondary}
            />
            <Text style={styles.unreadToggleText}>Unread Only</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.markAllBtn, loading && styles.disabledBtn]}
            onPress={handleMarkAllRead}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.blue} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color={colors.blue} />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.notification_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.blue} />
        }
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Inbox Clean</Text>
            <Text style={styles.emptySubtitle}>
              You have no {unreadOnly ? 'unread' : ''} notifications matching the selected filter.
            </Text>
          </GlassCard>
        }
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 10,
    backgroundColor: colors.navy,
  },
  filterList: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeFilterTab: {
    backgroundColor: colors.blue + '15',
    borderColor: colors.blue + '40',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeFilterTabText: {
    color: colors.blue,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  unreadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadToggleText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.blue,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  itemWrapper: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  unreadWrapper: {
    borderWidth: 1,
    borderColor: colors.blue + '30',
  },
  card: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  boldText: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue,
    marginLeft: 8,
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.navy === '#F5F6FA' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
    paddingTop: 8,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSecondary,
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
