import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AssignmentsScreen from '../screens/AssignmentsScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import ChecklistScreen from '../screens/ChecklistScreen';
import IncidentReportScreen from '../screens/IncidentReportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import QRPlaceholderScreen from '../screens/QRPlaceholderScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import { useVolunteerStore } from '../store/useVolunteerStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  const colors = useThemeColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: colors.navy }
      }}
    >
      <Stack.Screen name="Dashboard" component={HomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="Checklist" component={ChecklistScreen} />
      <Stack.Screen name="ReportIncident" options={{ title: 'Report Incident' }} component={IncidentReportScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const colors = useThemeColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: colors.navy }
      }}
    >
      <Stack.Screen name="MyProfile" options={{ title: 'My Profile' }} component={ProfileScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="Settings" options={{ title: 'Settings' }} component={SettingsScreen} />
    </Stack.Navigator>
  );
}

function MainTabNavigator() {
  const colors = useThemeColors();
  // Live Mode → real QR scanner; any other mode → existing placeholder (Demo unchanged)
  const systemMode = useVolunteerStore((state) => state.systemMode);
  const QRScreen = systemMode === 'Live' ? QRScannerScreen : QRPlaceholderScreen;

  React.useEffect(() => {
    console.log(`[Navigation] System mode changed in store: "${systemMode}". Selected QR screen component: ${systemMode === 'Live' ? 'QRScannerScreen (Real Scanner)' : 'QRPlaceholderScreen (Mock Placeholder)'}`);
  }, [systemMode]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'HomeStack') iconName = 'grid-outline';
          else if (route.name === 'Assignments') iconName = 'notifications-outline';
          else if (route.name === 'QR Verification') iconName = 'qr-code-outline';
          else if (route.name === 'ProfileStack') iconName = 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="HomeStack" options={{ title: 'Home' }} component={HomeStack} />
      <Tab.Screen name="Assignments" component={AssignmentsScreen} />
      <Tab.Screen name="QR Verification" component={QRScreen} />
      <Tab.Screen name="ProfileStack" options={{ title: 'Profile' }} component={ProfileStack} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token = useVolunteerStore((state) => state.token);
  const colors = useThemeColors();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.navy } }}>
        {token === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="MainApp" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
