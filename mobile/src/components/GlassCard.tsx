import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  const colors = useThemeColors();
  
  // Map light/dark glass backgrounds
  const isLight = colors.navy === '#F5F6FA';
  const glassStyle = {
    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(19, 22, 39, 0.85)',
    borderColor: isLight ? 'rgba(228, 231, 239, 0.8)' : 'rgba(255, 255, 255, 0.06)',
  };

  return <View style={[styles.card, glassStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
});
