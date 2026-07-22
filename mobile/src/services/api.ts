import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from './config';

const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 8000,
});

let stopLogging = false;

api.interceptors.request.use(async (config) => {
  if (stopLogging) {
    return config;
  }

  const reqCreatedTime = Date.now();
  const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
  console.log(`================================\nREQUEST CREATED\nTimestamp: ${reqCreatedTime}\nMethod: ${config.method?.toUpperCase()}\nFull URL: ${fullUrl}\nTimeout: ${config.timeout}\n================================`);

  console.log(`REQUEST ENTERS INTERCEPTOR\nTimestamp: ${Date.now()}`);

  const ssStart = Date.now();
  try {
    const token = await SecureStore.getItemAsync('user_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('[API Client] SecureStore token retrieval failed:', error);
  }
  const ssEnd = Date.now();

  console.log(`REQUEST LEAVES INTERCEPTOR\nTimestamp: ${ssEnd}\nElapsed Time: ${ssEnd - ssStart}ms`);

  const originalAdapter = config.adapter || api.defaults.adapter || axios.defaults.adapter;
  if (originalAdapter) {
    config.adapter = async (adapterConfig) => {
      if (stopLogging) {
        return (originalAdapter as any)(adapterConfig);
      }

      console.log(`REQUEST SENT TO NATIVE NETWORK\nTimestamp: ${Date.now()}`);

      const originalOnDownloadProgress = adapterConfig.onDownloadProgress;
      let firstByteLogged = false;
      adapterConfig.onDownloadProgress = (progressEvent) => {
        if (!stopLogging && !firstByteLogged) {
          firstByteLogged = true;
          console.log(`FIRST BYTE RECEIVED\nTimestamp: ${Date.now()}`);
        }
        if (originalOnDownloadProgress) {
          originalOnDownloadProgress(progressEvent);
        }
      };

      try {
        const response = await (originalAdapter as any)(adapterConfig);
        if (!stopLogging) {
          console.log(`REQUEST FINISHED\nTimestamp: ${Date.now()}\n================================`);
        }
        return response;
      } catch (err: any) {
        const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.status === 408;
        if (!stopLogging) {
          if (isTimeout) {
            stopLogging = true;
          }
          console.log(`REQUEST FAILED\nExact Axios Error: ${err}\nAxios Error Code: ${err.code}\nAxios Error Message: ${err.message}\nconfig.url: ${adapterConfig.url}\nconfig.baseURL: ${adapterConfig.baseURL}\nconfig.timeout: ${adapterConfig.timeout}\nsignal.aborted: ${adapterConfig.signal?.aborted || false}\nnavigator.onLine: ${typeof navigator !== 'undefined' ? (navigator as any).onLine : 'N/A (React Native)'}\n================================`);
        }
        throw err;
      }
    };
  }

  return config;
});

export default api;
