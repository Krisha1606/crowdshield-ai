import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0';
const CUSTOM_URL_KEY = 'crowdshield_custom_api_url';

// ─── Types ────────────────────────────────────────────────────────────────────
type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = ({
  title,
  icon,
  color,
}) => {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: `${color}22`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 }}>
        {title}
      </Text>
    </View>
  );
};

const RowDivider: React.FC = () => {
  const colors = useThemeColors();
  return <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.4, marginVertical: 2 }} />;
};

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 }}>
      <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text
        style={{
          fontSize: 14,
          color: valueColor || colors.textPrimary,
          fontWeight: '600',
          maxWidth: '60%',
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
};

const ConnectionBadge: React.FC<{ status: ConnectionStatus; responseMs: number | null }> = ({
  status,
  responseMs,
}) => {
  const colors = useThemeColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'testing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status]);

  if (status === 'idle') return null;

  const config = {
    testing: { color: colors.orange, icon: 'radio-outline' as const, text: 'Connecting…' },
    connected: { color: colors.green, icon: 'checkmark-circle-outline' as const, text: responseMs ? `Connected · ${responseMs}ms` : 'Connected' },
    failed: { color: colors.red, icon: 'close-circle-outline' as const, text: 'Connection Failed' },
  }[status];

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: `${config.color}15`,
        borderWidth: 1,
        borderColor: `${config.color}35`,
        opacity: status === 'testing' ? pulseAnim : 1,
      }}
    >
      <Ionicons name={config.icon} size={16} color={config.color} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: config.color }}>{config.text}</Text>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }: any) {
  const colors = useThemeColors();
  const { theme, toggleTheme, setTheme, systemMode, logout } = useVolunteerStore();

  // Server URL state
  const [urlInput, setUrlInput] = useState<string>('');
  const [savedUrl, setSavedUrl] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [responseMs, setResponseMs] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const styles = getStyles(colors);

  // ── On mount: load persisted custom URL or fall back to current api baseURL ──
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(CUSTOM_URL_KEY);
        const current = stored || (api.defaults.baseURL ?? '');
        setUrlInput(current);
        setSavedUrl(current);
      } catch {
        const current = api.defaults.baseURL ?? '';
        setUrlInput(current);
        setSavedUrl(current);
      }
    })();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isDark = theme === 'dark';

  const handleToggleTheme = () => {
    toggleTheme();
  };

  const handleTestConnection = async () => {
    const testUrl = urlInput.trim().replace(/\/$/, '');
    if (!testUrl) {
      Alert.alert('Missing URL', 'Please enter a server URL before testing.');
      return;
    }
    setConnectionStatus('testing');
    setResponseMs(null);
    const t0 = Date.now();
    try {
      const response = await fetch(`${testUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        setResponseMs(Date.now() - t0);
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('failed');
      }
    } catch {
      setConnectionStatus('failed');
    }
  };

  const handleSaveUrl = async () => {
    const newUrl = urlInput.trim().replace(/\/$/, '');
    if (!newUrl) {
      Alert.alert('Missing URL', 'Please enter a valid server URL.');
      return;
    }
    setIsSaving(true);
    try {
      // 1. Persist to SecureStore
      await SecureStore.setItemAsync(CUSTOM_URL_KEY, newUrl);
      // 2. Apply immediately to the api axios instance — no restart needed
      api.defaults.baseURL = newUrl;
      setSavedUrl(newUrl);
      // 3. Reset connection badge
      setConnectionStatus('idle');
      setResponseMs(null);
      Alert.alert('Saved', `API URL updated to:\n${newUrl}`);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save URL. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetUrl = async () => {
    Alert.alert(
      'Reset to Default',
      'This will remove the custom URL and use the auto-detected IP from the Expo development server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(CUSTOM_URL_KEY);
              // Restore original CONFIG url — we can't re-call getLocalIp() at runtime,
              // so we just indicate the user needs to restart the app to auto-detect
              Alert.alert(
                'Reset Done',
                'Custom URL cleared. Restart the app to auto-detect the server IP.'
              );
              setUrlInput('');
              setSavedUrl('');
              setConnectionStatus('idle');
            } catch {
              Alert.alert('Error', 'Failed to reset URL.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/auth/logout');
          } catch {
            // Even if API logout fails, clear local credentials
          }
          await logout();
        },
      },
    ]);
  };

  const urlHasUnsavedChanges = urlInput.trim().replace(/\/$/, '') !== savedUrl;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.navy }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderIconWrap}>
            <Ionicons name="settings-outline" size={24} color={colors.blue} />
          </View>
          <View>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>App preferences & configuration</Text>
          </View>
        </View>

        {/* ── 1. Appearance ──────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader title="Appearance" icon="color-palette-outline" color={colors.blue} />

          <View style={styles.switchRow}>
            <View style={styles.switchLabelGroup}>
              <Ionicons
                name={isDark ? 'moon-outline' : 'sunny-outline'}
                size={20}
                color={isDark ? colors.blue : colors.orange}
                style={{ marginRight: 10 }}
              />
              <View>
                <Text style={styles.switchLabel}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
                <Text style={styles.switchSub}>
                  {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleToggleTheme}
              trackColor={{ false: colors.border, true: colors.blue }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </GlassCard>

        {/* ── 2. Server Configuration ────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader title="Server Configuration" icon="server-outline" color={colors.orange} />

          <Text style={styles.fieldLabel}>API Server URL</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                urlHasUnsavedChanges && { borderColor: colors.orange },
              ]}
              value={urlInput}
              onChangeText={(t) => {
                setUrlInput(t);
                setConnectionStatus('idle');
              }}
              placeholder="http://192.168.x.x:8000"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              selectTextOnFocus
            />
          </View>

          {urlHasUnsavedChanges && (
            <Text style={styles.unsavedHint}>
              Unsaved change — tap Save to apply
            </Text>
          )}

          <ConnectionBadge status={connectionStatus} responseMs={responseMs} />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: `${colors.orange}18`, borderColor: `${colors.orange}40` }]}
              onPress={handleTestConnection}
              activeOpacity={0.75}
              disabled={connectionStatus === 'testing'}
            >
              {connectionStatus === 'testing' ? (
                <ActivityIndicator size="small" color={colors.orange} />
              ) : (
                <Ionicons name="wifi-outline" size={16} color={colors.orange} />
              )}
              <Text style={[styles.smallBtnText, { color: colors.orange }]}>
                {connectionStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallBtn,
                { backgroundColor: `${colors.blue}18`, borderColor: `${colors.blue}40` },
                !urlHasUnsavedChanges && { opacity: 0.45 },
              ]}
              onPress={handleSaveUrl}
              activeOpacity={0.75}
              disabled={!urlHasUnsavedChanges || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.blue} />
              ) : (
                <Ionicons name="save-outline" size={16} color={colors.blue} />
              )}
              <Text style={[styles.smallBtnText, { color: colors.blue }]}>
                {isSaving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.resetLink} onPress={handleResetUrl} activeOpacity={0.6}>
            <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.resetLinkText}>Reset to auto-detected IP</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* ── 3. System Info ─────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader title="System Info" icon="information-circle-outline" color={colors.green} />

          <InfoRow label="App Version" value={`v${APP_VERSION}`} />
          <RowDivider />
          <InfoRow
            label="System Mode"
            value={systemMode}
            valueColor={systemMode === 'Live' ? colors.blue : colors.orange}
          />
          <RowDivider />
          <InfoRow
            label="Active API URL"
            value={savedUrl || api.defaults.baseURL || '—'}
            valueColor={colors.textSecondary}
          />
          <RowDivider />
          <InfoRow label="Platform" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
        </GlassCard>

        {/* ── 4. Session ─────────────────────────────────────────────── */}
        <GlassCard style={styles.card}>
          <SectionHeader title="Session" icon="log-out-outline" color={colors.red} />
          <Text style={styles.logoutHint}>
            Signing out will clear your session credentials. You will need to log in again.
          </Text>
          <ActionButton
            title="Sign Out"
            variant="danger"
            onPress={handleLogout}
            style={{ marginTop: 14 }}
          />
        </GlassCard>

        <Text style={styles.footerText}>CrowdShield AI · Volunteer App · v{APP_VERSION}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (colors: ReturnType<typeof import('../hooks/useThemeColors').useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.navy,
    },
    content: {
      padding: 16,
      paddingBottom: 48,
    },
    // Header
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      marginTop: 4,
      gap: 14,
    },
    pageHeaderIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor: `${colors.blue}18`,
      borderWidth: 1,
      borderColor: `${colors.blue}30`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    pageSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // Card
    card: {
      marginBottom: 16,
    },
    // Switch row
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    switchLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    switchLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    switchSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // URL input
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    textInput: {
      flex: 1,
      height: 46,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: `${colors.border}30`,
      paddingHorizontal: 13,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    unsavedHint: {
      fontSize: 11,
      color: colors.orange,
      marginTop: 6,
      marginLeft: 2,
      fontWeight: '600',
    },
    // Button row
    btnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    smallBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 42,
      borderRadius: 9,
      borderWidth: 1,
    },
    smallBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
    resetLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
      alignSelf: 'center',
    },
    resetLinkText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    // Logout
    logoutHint: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    // Footer
    footerText: {
      textAlign: 'center',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 8,
      opacity: 0.5,
    },
  });
