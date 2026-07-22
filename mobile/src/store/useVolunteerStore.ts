import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

interface SyncData {
  profile: any;
  activeAssignment: any;
  attendanceStatus: any;
  announcements: any[];
  notifications: any[];
  syncTime: Date;
}

interface VolunteerState {
  token: string | null;
  volunteerId: number | null;
  volunteerName: string | null;
  assignedGate: string | null;
  assignedGateId: number | null;
  status: string;
  systemMode: 'Demo' | 'Live';
  activeAssignment: any | null;
  profile: any | null;
  attendanceStatus: any | null;
  announcements: any[];
  notifications: any[];
  syncTime: Date | null;
  theme: 'light' | 'dark';
  isLoading: boolean;
  login: (token: string, details: any) => Promise<void>;
  logout: () => Promise<void>;
  setStatus: (status: string) => void;
  setSyncData: (data: SyncData) => void;
  setActiveAssignment: (assignment: any) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  bootstrap: () => Promise<void>;
}

export const useVolunteerStore = create<VolunteerState>((set) => ({
  token: null,
  volunteerId: null,
  volunteerName: null,
  assignedGate: null,
  assignedGateId: null,
  status: 'Offline',
  systemMode: 'Demo',
  activeAssignment: null,
  profile: null,
  attendanceStatus: null,
  announcements: [],
  notifications: [],
  syncTime: null,
  theme: 'light',
  isLoading: true,
  login: async (token, details) => {
    try {
      const ssStart = Date.now();
      await SecureStore.setItemAsync('user_token', token);
      const ssEnd = Date.now();
      console.log(`[TIMING] [Store login] SecureStore.setItemAsync took ${ssEnd - ssStart}ms`);
      
      // Fetch system mode on login
      let fetchedMode: 'Demo' | 'Live' = 'Demo';
      const modeStart = Date.now();
      try {
        console.log(`[TIMING] [Store login] Dispatching GET /system/mode at ${modeStart}`);
        const modeRes = await api.get('/system/mode');
        const modeEnd = Date.now();
        console.log(`[TIMING] [Store login] GET /system/mode completed in ${modeEnd - modeStart}ms`);
        fetchedMode = modeRes.data?.system_mode || 'Demo';
        console.log('[Store] System mode resolved at login:', fetchedMode);
      } catch (err: any) {
        const modeEnd = Date.now();
        console.warn(`[TIMING] [Store login] GET /system/mode failed in ${modeEnd - modeStart}ms. Error:`, err.message);
      }

      set({
        token,
        volunteerId: details.user_id || details.volunteer_id,
        volunteerName: details.full_name || details.volunteer_name || details.username,
        assignedGate: details.gate_name || null,
        assignedGateId: details.assigned_gate || null,
        status: details.status || 'Available',
        systemMode: fetchedMode,
      });
    } catch (e) {
      console.error('[Store] Failed to write token to SecureStore:', e);
    }
  },
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('user_token');
      set({
        token: null,
        volunteerId: null,
        volunteerName: null,
        assignedGate: null,
        assignedGateId: null,
        status: 'Offline',
        systemMode: 'Demo',
        activeAssignment: null,
        profile: null,
        attendanceStatus: null,
        announcements: [],
        notifications: [],
        syncTime: null,
      });
    } catch (e) {
      console.error('[Store] Failed to clear token from SecureStore:', e);
    }
  },
  setStatus: (status) => set({ status }),
  setSyncData: (data) =>
    set({
      profile: data.profile,
      activeAssignment: data.activeAssignment,
      attendanceStatus: data.attendanceStatus,
      announcements: data.announcements,
      notifications: data.notifications,
      syncTime: data.syncTime,
      // Keep local status synchronized with fetched profile status
      status: data.profile?.status || 'Offline',
      assignedGate: data.profile?.gate_name || null,
      assignedGateId: data.profile?.assigned_gate || null,
      systemMode: data.profile?.system_mode || 'Demo',
    }),
  setActiveAssignment: (activeAssignment) => set({ activeAssignment }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  setTheme: (theme) => set({ theme }),
  bootstrap: async () => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (token) {
        set({ token });
        try {
          const profileRes = await api.get('/volunteers/my-profile');
          const profile = profileRes.data;
          set({
            token,
            volunteerId: profile.volunteer_id,
            volunteerName: profile.volunteer_name,
            assignedGate: profile.gate_name || null,
            assignedGateId: profile.assigned_gate || null,
            status: profile.status || 'Offline',
            systemMode: profile.system_mode || 'Demo',
            profile: profile,
            isLoading: false,
          });
        } catch (apiErr: any) {
          console.warn('[Store] API validation failed during bootstrap:', apiErr.message || apiErr);
          if (apiErr.response && (apiErr.response.status === 401 || apiErr.response.status === 403)) {
            await SecureStore.deleteItemAsync('user_token');
            set({
              token: null,
              volunteerId: null,
              volunteerName: null,
              assignedGate: null,
              assignedGateId: null,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn('[Store] SecureStore read error during bootstrap:', err);
      set({ isLoading: false });
    }
  },
}));
