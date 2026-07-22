import { useEffect, useRef } from 'react';
import axios from 'axios';
import api from '../services/api';
import { useVolunteerStore } from '../store/useVolunteerStore';
import { CONFIG } from '../services/config';

export function useSyncMonitor() {
  const { token, setSyncData, logout, systemMode } = useVolunteerStore();
  const syncTimer = useRef<NodeJS.Timeout | null>(null);
  const prevMode = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    const performSync = async () => {
      if (!token || !active) return;

      // Cancel any previous pending requests in flight from the prior cycle
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const cycleStart = Date.now();
      console.log(`[TIMING] [Sync Monitor] Sync cycle started at ${cycleStart}. Local systemMode in store: "${systemMode}"`);

      const fetchWithFallback = async (name: string, endpoint: string) => {
        const start = Date.now();
        console.log(`[TIMING] [Sync Monitor] Dispatching GET ${endpoint} at ${start}`);
        try {
          const res = await api.get(endpoint, { signal });
          const end = Date.now();
          console.log(`[TIMING] [Sync Monitor] GET ${endpoint} completed in ${end - start}ms`);
          return res;
        } catch (err: any) {
          const end = Date.now();
          if (axios.isCancel(err)) {
            console.log(`[TIMING] [Sync Monitor] Request cancelled: ${name} in ${end - start}ms`);
          } else {
            console.warn(`[TIMING] [Sync Monitor] Failed to fetch endpoint: ${name} (${endpoint}) in ${end - start}ms. Error: ${err.message || err}`);
          }
          return null;
        }
      };

      try {
        // Fetch all synchronization dependencies concurrently with the abort signal
        const promiseStart = Date.now();
        const [profileRes, requestsRes, attendanceRes, announcementsRes, notificationsRes] = await Promise.all([
          fetchWithFallback('Profile', '/volunteers/my-profile'),
          fetchWithFallback('AssignmentRequests', '/volunteers/my-requests'),
          fetchWithFallback('Attendance', '/attendance/status'),
          fetchWithFallback('Announcements', '/announcements'),
          fetchWithFallback('Notifications', '/volunteers/notifications')
        ]);
        const promiseEnd = Date.now();
        console.log(`[TIMING] [Sync Monitor] Promise.all of 5 sync endpoints completed in ${promiseEnd - promiseStart}ms`);

        if (!active) return;

        if (profileRes) {
          const fetchedMode = profileRes.data?.system_mode || 'Demo';
          console.log(`[Sync Monitor] Detected system mode from profile: "${fetchedMode}"`);

          if (prevMode.current !== null && prevMode.current !== fetchedMode) {
            console.log(`[Sync Monitor] SYSTEM MODE CHANGED: "${prevMode.current}" -> "${fetchedMode}"`);
          }
          prevMode.current = fetchedMode;

          const requestsList = requestsRes?.data || [];
          const activeReq = requestsList.length > 0 ? requestsList[0] : null;

          setSyncData({
            profile: profileRes.data,
            activeAssignment: activeReq,
            attendanceStatus: attendanceRes?.data || null,
            announcements: announcementsRes?.data || [],
            notifications: notificationsRes?.data || [],
            syncTime: new Date()
          });
        } else {
          console.warn('[Sync Monitor] Profile data missing from sync cycle. Trying GET /system/mode anonymous endpoint as fallback.');
          
          try {
            const modeRes = await api.get('/system/mode', { signal });
            if (!active) return;
            const anonMode = modeRes.data?.system_mode || 'Demo';
            console.log(`[Sync Monitor] Fallback system mode from GET /system/mode: "${anonMode}"`);
            
            if (prevMode.current !== null && prevMode.current !== anonMode) {
              console.log(`[Sync Monitor] SYSTEM MODE CHANGED (via fallback): "${prevMode.current}" -> "${anonMode}"`);
            }
            prevMode.current = anonMode;

            // Update only systemMode in the store while leaving other profile details intact
            useVolunteerStore.setState({ systemMode: anonMode });
          } catch (modeErr: any) {
            if (!axios.isCancel(modeErr)) {
              console.error('[Sync Monitor] Fallback GET /system/mode also failed:', modeErr.message || modeErr);
            }
          }
        }
      } catch (e: any) {
        if (!axios.isCancel(e)) {
          console.error('[Sync Monitor] Critical synchronization loop error:', e.message || e);
          if (e.response?.status === 401) {
            await logout(); // Force logout on session expiry
          }
        }
      } finally {
        // Schedule next sync only after the current one has fully completed
        if (active) {
          syncTimer.current = setTimeout(performSync, CONFIG.SYNC_INTERVAL_MS);
        }
      }
    };

    if (token) {
      prevMode.current = systemMode;
      performSync();
    }

    return () => {
      active = false;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [token]);
}
