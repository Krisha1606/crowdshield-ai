import axios from 'axios';

export const getApiBaseUrl = (): string => {
  return localStorage.getItem('crowdshield_api_url') || 'http://127.0.0.1:8000';
};

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('crowdshield_api_url', url);
  window.dispatchEvent(new Event('api_url_changed'));
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem('crowdshield_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
