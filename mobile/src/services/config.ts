import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getLocalIp = (): string => {
  // Dynamically resolve development host IP using expo-constants
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      console.log('[CONFIG] Dynamically resolved API LAN IP:', ip);
      return ip;
    }
  }
  return '192.168.19.223'; // Fallback to current development machine IP
};

const LOCAL_LAN_IP = getLocalIp();
const LOCAL_PORT = '8000';

function getBaseUrl(): string {
  if (__DEV__ === false) {
    return 'https://api.crowdshield.ai';
  }
  const url = `http://${LOCAL_LAN_IP}:${LOCAL_PORT}`;
  console.log('[CONFIG] API base URL at runtime:', url);
  return url;
}

export const CONFIG = {
  API_BASE_URL: getBaseUrl(),
  SYNC_INTERVAL_MS: 7000,
};
