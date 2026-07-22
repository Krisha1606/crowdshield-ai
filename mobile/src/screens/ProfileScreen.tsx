import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';

export default function ProfileScreen({ navigation }: any) {
  const { logout } = useVolunteerStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [perfData, setPerfData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchProfileAndPerformance = async () => {
    setLoading(true);
    try {
      const [profRes, perfRes] = await Promise.all([
        api.get('/volunteers/my-profile'),
        api.get('/volunteers/performance'),
      ]);
      setProfileData(profRes.data);
      setPerfData(perfRes.data);
    } catch (e: any) {
      console.warn('[Profile fetch error]', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndPerformance();
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/auth/logout');
          } catch (e) {
            // Even if API logout fails, clear local credentials
          }
          await logout();
        },
      },
    ]);
  };

  const startEditing = () => {
    setEditName(profileData?.volunteer_name || '');
    setEditPhone(profileData?.phone || '');
    setEditEmail(profileData?.email || '');
    setIsEditing(true);
  };

  const validateInputs = () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Volunteer name cannot be empty.');
      return false;
    }
    if (editName.trim().length < 2) {
      Alert.alert('Validation Error', 'Volunteer name must be at least 2 characters.');
      return false;
    }
    if (!editPhone.trim()) {
      Alert.alert('Validation Error', 'Contact phone cannot be empty.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editEmail.trim() || !emailRegex.test(editEmail.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSaveProfile = async () => {
    if (!validateInputs()) return;
    setSaveLoading(true);
    try {
      await api.put('/volunteers/my-profile', {
        volunteer_name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        profile_photo: profileData?.profile_photo || '',
      });
      
      Alert.alert('Success', 'Profile updated successfully.');
      setIsEditing(false);
      await fetchProfileAndPerformance();
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to update profile.';
      Alert.alert('Error', msg);
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading && !profileData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Fetching profile records...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GlassCard style={styles.avatarCard}>
        <View style={styles.avatarWrapper}>
          <Ionicons name="person-circle-outline" size={80} color={colors.blue} />
        </View>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.nameInput]}
            value={editName}
            onChangeText={setEditName}
            placeholder="Volunteer Name"
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <Text style={styles.name}>{profileData?.volunteer_name || 'Volunteer'}</Text>
        )}
        <Text style={styles.role}>Operational Field Agent</Text>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionHeader}>Staff Identification</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Volunteer ID</Text>
          <Text style={styles.value}>#{profileData?.volunteer_id}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Email Address"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.value}>{profileData?.email || 'N/A'}</Text>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Contact Phone</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Phone Number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{profileData?.phone || 'N/A'}</Text>
          )}
        </View>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionHeader}>Duty Profile</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Assigned Gate</Text>
          <Text style={styles.value}>{profileData?.gate_name || 'Reserve Pool'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Shift Status</Text>
          <Text style={styles.value}>{profileData?.attendance_status || 'Absent'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Emergency Line</Text>
          <Text style={styles.value}>{profileData?.contact || 'N/A'}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionHeader}>Performance & Statistics</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Safety Score Rating</Text>
          <Text style={[styles.value, { color: colors.green, fontWeight: 'bold' }]}>
            {perfData?.operator_score || '90.0'}%
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Checklists Submitted</Text>
          <Text style={styles.value}>{perfData?.checklists_submitted || 0}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Incidents Reported</Text>
          <Text style={styles.value}>{perfData?.incidents_filed || 0}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Shifts Logged</Text>
          <Text style={styles.value}>{perfData?.shifts_completed || 0}</Text>
        </View>
      </GlassCard>

      {isEditing ? (
        <>
          <ActionButton
            title={saveLoading ? "Saving..." : "Save Profile Details"}
            variant="primary"
            onPress={handleSaveProfile}
            style={styles.announceBtn}
            disabled={saveLoading}
          />
          <ActionButton
            title="Cancel Editing"
            variant="secondary"
            onPress={() => setIsEditing(false)}
            style={styles.settingsBtn}
            disabled={saveLoading}
          />
        </>
      ) : (
        <>
          <ActionButton
            title="Edit Profile"
            variant="primary"
            onPress={startEditing}
            style={styles.announceBtn}
          />
          <ActionButton
            title="View Announcements"
            variant="secondary"
            onPress={() => navigation.navigate('Announcements')}
            style={styles.settingsBtn}
          />
          <ActionButton
            title="⚙️  App Settings"
            variant="secondary"
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsBtn}
          />
          <ActionButton title="Sign Out" variant="danger" onPress={handleLogout} style={styles.logoutBtn} />
        </>
      )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  avatarCard: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
  },
  avatarWrapper: {
    marginBottom: 10,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  role: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.blue,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.4,
  },
  input: {
    width: '65%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    textAlign: 'right',
  },
  nameInput: {
    width: '80%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  announceBtn: {
    marginTop: 10,
  },
  settingsBtn: {
    marginTop: 10,
  },
  logoutBtn: {
    marginTop: 12,
  },
});
