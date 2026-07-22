import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { GlassCard } from '../components/GlassCard';
import { ActionButton } from '../components/ActionButton';
import { useVolunteerStore } from '../store/useVolunteerStore';
import api from '../services/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [systemMode, setSystemMode] = useState<string>('Demo');
  const login = useVolunteerStore((state) => state.login);
  const colors = useThemeColors();
  const styles = getStyles(colors);

  React.useEffect(() => {
    const fetchMode = async () => {
      try {
        const res = await api.get('/system/mode');
        setSystemMode(res.data.system_mode || 'Demo');
      } catch (err) {
        console.error('[Login] Failed to fetch system mode:', err);
      }
    };
    fetchMode();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please fill in all credentials.');
      return;
    }

    const loginProcessStart = Date.now();
    console.log(`[TIMING] [LoginScreen] Login process initiated at ${loginProcessStart}`);
    setLoading(true);
    try {
      // 1. Submit login request to FastAPI backend
      const apiStart = Date.now();
      console.log(`[TIMING] [LoginScreen] Dispatching POST /auth/login at ${apiStart}`);
      const response = await api.post('/auth/login', {
        username: username.trim(),
        password: password,
      });
      const apiEnd = Date.now();
      console.log(`[TIMING] [LoginScreen] POST /auth/login completed in ${apiEnd - apiStart}ms`);

      const { access_token, user } = response.data;
      
      // 2. Complete store session authentication
      const storeLoginStart = Date.now();
      console.log(`[TIMING] [LoginScreen] Invoking Zustand login() at ${storeLoginStart}`);
      await login(access_token, user);
      const storeLoginEnd = Date.now();
      console.log(`[TIMING] [LoginScreen] Zustand login() completed in ${storeLoginEnd - storeLoginStart}ms`);
      
      const totalTime = Date.now() - loginProcessStart;
      console.log(`[TIMING] [LoginScreen] Total login process successfully completed in ${totalTime}ms`);
    } catch (e: any) {
      console.error('[Login Error]', e);
      let errMsg = 'Invalid username or password.';
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        errMsg = 'Connection timeout. The server took too long to respond.';
      } else if (e.message === 'Network Error') {
        errMsg = 'Network Error. Please check your WiFi connection and ensure the server host (192.168.9.49) is reachable.';
      } else if (e.response) {
        if (e.response.status === 401) {
          errMsg = e.response.data?.detail || 'Invalid username or password.';
        } else if (e.response.status === 500) {
          errMsg = 'Internal Server Error (500). Please check the backend console logs.';
        } else {
          errMsg = e.response.data?.detail || `Error (${e.response.status}): ${e.message}`;
        }
      } else {
        errMsg = e.message || 'An unknown network error occurred.';
      }
      Alert.alert('Login Failed', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.headerArea}>
        <Ionicons name="shield-checkmark-outline" size={80} color={colors.blue} />
        <Text style={styles.title}>CrowdShield AI</Text>
        <Text style={styles.subtitle}>Volunteer Companion App</Text>
      </View>

      <View style={{
        alignSelf: 'center',
        marginBottom: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: systemMode === 'Live' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: systemMode === 'Live' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(245, 158, 11, 0.3)',
      }}>
        <Text style={{
          fontSize: 9,
          fontWeight: 'bold',
          color: systemMode === 'Live' ? '#818cf8' : '#fbbf24',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>Connected Server Mode: {systemMode} Mode</Text>
      </View>

      <GlassCard style={styles.formCard}>
        <Text style={styles.formHeader}>Sign In</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secureTextEntry}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setSecureTextEntry(!secureTextEntry)}>
              <Ionicons
                name={secureTextEntry ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.blue} style={styles.loader} />
        ) : (
          <ActionButton title="Sign In" onPress={handleLogin} style={styles.button} />
        )}
      </GlassCard>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    padding: 20,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  formCard: {
    paddingVertical: 24,
  },
  formHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy === '#F5F6FA' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  loader: {
    marginTop: 16,
  },
  button: {
    marginTop: 16,
  },
});
