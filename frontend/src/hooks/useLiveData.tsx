import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { GateAssignment, AssignmentRequest, StaffNotif, Gate } from '../types';

export interface LiveDataContextType {
  gates: GateAssignment[];
  gatesMetrics: Gate[];
  activeDispatches: AssignmentRequest[];
  impact: any;
  systemMode: string;
  simPhase: string;
  notifs: StaffNotif[];
  attendeeCount: number;
  isSimulating: boolean;
  isLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  restartSimulation: () => Promise<void>;
  setIsSimulating: React.Dispatch<React.SetStateAction<boolean>>;
}

const LiveDataContext = createContext<LiveDataContextType | undefined>(undefined);

export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gates, setGates] = useState<GateAssignment[]>([]);
  const [gatesMetrics, setGatesMetrics] = useState<Gate[]>([]);
  const [activeDispatches, setActiveDispatches] = useState<AssignmentRequest[]>([]);
  const [impact, setImpact] = useState<any>(null);
  const [systemMode, setSystemMode] = useState<string>('Demo');
  const [simPhase, setSimPhase] = useState<string>('Normal');
  const [notifs, setNotifs] = useState<StaffNotif[]>([]);
  const [attendeeCount, setAttendeeCount] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);

  // Single centralized fetch for all live metrics - fully concurrent via Promise.all
  const refreshAll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const [deficitsRes, metricsRes, modeRes, simRes, feedRes] = await Promise.all([
        api.get('/volunteers/deficits').catch(() => ({ data: null })),
        api.get('/gates/metrics').catch(() => ({ data: null })),
        api.get('/system/mode').catch(() => ({ data: null })),
        api.get('/simulation/status').catch(() => ({ data: null })),
        api.get('/alerts/staff-feed?limit=15').catch(() => ({ data: null }))
      ]);

      if (deficitsRes.data) {
        setGates(deficitsRes.data.gates || []);
        setActiveDispatches(deficitsRes.data.active_dispatches || []);
        setImpact(deficitsRes.data.impact || null);
      }

      if (metricsRes.data && Array.isArray(metricsRes.data)) {
        setGatesMetrics(metricsRes.data);
        const totalOcc = metricsRes.data.reduce((sum: number, g: any) => sum + (g.current_occupancy || 0), 0);
        setAttendeeCount(totalOcc);
      }

      if (modeRes.data && modeRes.data.system_mode) {
        setSystemMode(modeRes.data.system_mode);
      }

      if (simRes.data) {
        setIsSimulating(Boolean(simRes.data.active));
        if (simRes.data.phase) {
          setSimPhase(simRes.data.phase);
        }
      }

      if (feedRes.data && Array.isArray(feedRes.data) && feedRes.data.length > 0) {
        setNotifs(feedRes.data.slice(0, 8));
      }
    } catch (err: any) {
      console.warn('Centralized Live Data Fetch Warning:', err?.message || err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Centralized Start Simulation handler
  const startSimulation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post('/simulation/start');
      if (res.data.status === 'started' || res.data.status === 'running') {
        setIsSimulating(true);
        const syncTime = Date.now().toString();
        localStorage.setItem('crowdshield_sync_trigger', syncTime);
        window.dispatchEvent(new Event('crowdshield_sync_trigger'));
      } else {
        setError(`Failed to start simulation: unexpected status "${res.data.status}"`);
      }
      await refreshAll();
    } catch (err: any) {
      console.error('Failed to start simulation', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to start simulation.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshAll]);

  // Centralized Pause/Stop Simulation handler
  const pauseSimulation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post('/simulation/pause');
      if (res.data.status === 'stopped' || res.data.status === 'paused') {
        setIsSimulating(false);
        const syncTime = Date.now().toString();
        localStorage.setItem('crowdshield_sync_trigger', syncTime);
        window.dispatchEvent(new Event('crowdshield_sync_trigger'));
      } else {
        setError(`Failed to pause simulation: unexpected status "${res.data.status}"`);
      }
      await refreshAll();
    } catch (err: any) {
      console.error('Failed to pause simulation', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to pause simulation.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshAll]);

  // Centralized Restart Simulation handler
  const restartSimulation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post('/simulation/restart');
      if (res.data.status === 'success') {
        setIsSimulating(false);
        const syncTime = Date.now().toString();
        localStorage.setItem('crowdshield_sync_trigger', syncTime);
        window.dispatchEvent(new Event('crowdshield_sync_trigger'));
      } else {
        setError(`Failed to restart simulation: unexpected status "${res.data.status}"`);
      }
      await refreshAll();
    } catch (err: any) {
      console.error('Failed to restart simulation', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to restart simulation.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshAll]);

  // Initial load & storage sync event listeners
  useEffect(() => {
    refreshAll();

    const handleSyncTrigger = () => {
      refreshAll();
    };

    window.addEventListener('storage', handleSyncTrigger);
    window.addEventListener('crowdshield_sync_trigger', handleSyncTrigger);

    return () => {
      window.removeEventListener('storage', handleSyncTrigger);
      window.removeEventListener('crowdshield_sync_trigger', handleSyncTrigger);
    };
  }, [refreshAll]);

  // SINGLE CENTRALIZED MASTER POLLING INTERVAL (every 3.5s)
  useEffect(() => {
    const intervalTime = isSimulating ? 3000 : 3500;
    const masterInterval = setInterval(() => {
      refreshAll();
    }, intervalTime);

    return () => clearInterval(masterInterval);
  }, [isSimulating, refreshAll]);

  return (
    <LiveDataContext.Provider
      value={{
        gates,
        gatesMetrics,
        activeDispatches,
        impact,
        systemMode,
        simPhase,
        notifs,
        attendeeCount,
        isSimulating,
        isLoading,
        error,
        refreshAll,
        startSimulation,
        pauseSimulation,
        restartSimulation,
        setIsSimulating
      }}
    >
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => {
  const context = useContext(LiveDataContext);
  if (!context) {
    throw new Error('useLiveData must be used within a LiveDataProvider');
  }
  return context;
};
