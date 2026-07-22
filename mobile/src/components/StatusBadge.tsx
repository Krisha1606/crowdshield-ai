import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const colors = useThemeColors();

  const getBadgeStyle = () => {
    const s = status.toLowerCase();
    if (s === 'available' || s === 'safe' || s === 'completed' || s === 'checked in') {
      return { bg: 'rgba(34, 197, 94, 0.15)', text: colors.green };
    }
    if (s === 'en route' || s === 'accepted') {
      return { bg: 'rgba(59, 130, 246, 0.15)', text: colors.blue };
    }
    if (s === 'pending' || s === 'warning' || s === 'break') {
      return { bg: 'rgba(245, 158, 11, 0.15)', text: colors.orange };
    }
    if (s === 'arrived') {
      return { bg: 'rgba(20, 184, 166, 0.15)', text: '#14B8A6' }; // Teal status matching the web tag
    }
    if (s === 'dangerous' || s === 'critical' || s === 'rejected' || s === 'busy') {
      return { bg: 'rgba(239, 68, 68, 0.15)', text: colors.red };
    }
    // Default / Offline / Absent
    return { bg: 'rgba(136, 145, 168, 0.15)', text: colors.textSecondary };
  };

  const styleConfig = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: styleConfig.bg }]}>
      <Text style={[styles.text, { color: styleConfig.text }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
