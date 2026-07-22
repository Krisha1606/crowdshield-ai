import React from 'react';
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

interface ActionButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const ActionButton: React.FC<ActionButtonProps> = ({ title, variant = 'primary', style, ...props }) => {
  const colors = useThemeColors();

  const getButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return { backgroundColor: colors.red };
      case 'secondary':
        return { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border };
      default:
        return { backgroundColor: colors.blue };
    }
  };

  return (
    <TouchableOpacity style={[styles.button, getButtonStyle(), style]} activeOpacity={0.7} {...props}>
      <Text style={[styles.text, { color: colors.textPrimary }]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  text: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});
