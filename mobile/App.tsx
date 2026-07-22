import React, { useEffect } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useVolunteerStore } from './src/store/useVolunteerStore';
import { darkColors, lightColors } from './src/theme/colors';

export default function App() {
  const theme = useVolunteerStore((state) => state.theme);
  const bootstrap = useVolunteerStore((state) => state.bootstrap);
  const isLoading = useVolunteerStore((state) => state.isLoading);
  const colors = theme === 'light' ? lightColors : darkColors;
  const barStyle = theme === 'light' ? 'dark-content' : 'light-content';

  useEffect(() => {
    bootstrap();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.navy }}>
        <ActivityIndicator size="large" color={colors.blue || '#007AFF'} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={barStyle} backgroundColor={colors.navy} />
      <AppNavigator />
    </>
  );
}
