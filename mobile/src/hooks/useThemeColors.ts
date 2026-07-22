import { useVolunteerStore } from '../store/useVolunteerStore';
import { lightColors, darkColors } from '../theme/colors';

export function useThemeColors() {
  const theme = useVolunteerStore((state) => state.theme || 'dark');
  return theme === 'light' ? lightColors : darkColors;
}
