import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { Ionicons } from '@expo/vector-icons';

export default function QRPlaceholderScreen() {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <GlassCard style={styles.content}>
        <Ionicons name="qr-code-outline" size={72} color={colors.blue} />
        <Text style={styles.title}>QR Ticket Scanner</Text>
        <Text style={styles.subtitle}>
          QR verification will be available in Live Mode.
        </Text>
        <Text style={styles.subtext}>
          The system is currently running in Simulation Mode. Tickets are verified automatically by the backend.
        </Text>
        <View style={styles.badgeWrapper}>
          <Text style={styles.badgeText}>Simulation Mode Active</Text>
        </View>
      </GlassCard>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  subtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  badgeWrapper: {
    marginTop: 30,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
