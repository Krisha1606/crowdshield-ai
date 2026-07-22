import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Database, 
  User, 
  Lock, 
  Sliders, 
  CheckCircle, 
  AlertTriangle,
  Info,
  UserCheck
} from 'lucide-react';
import api, { getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  
  // API URL State
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  
  // Simulation State
  const [simulatePeak, setSimulatePeak] = useState(
    localStorage.getItem('crowdshield_simulate_peak') === 'true'
  );

  // Status notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isReseeding, setIsReseeding] = useState(false);

  // Volunteer settings state
  const [assignmentMode, setAssignmentMode] = useState<'Demo' | 'Production'>('Demo');
  const [simulationDelay, setSimulationDelay] = useState<number>(3);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [systemMode, setSystemMode] = useState<'Demo' | 'Live'>('Demo');

  const fetchVolunteerSettings = async () => {
    try {
      const [volSettingsRes, systemModeRes] = await Promise.all([
        api.get('/admin/volunteer-mode'),
        api.get('/admin/system-mode').catch(() => ({ data: { system_mode: 'Demo' } }))
      ]);
      const modeVal = volSettingsRes.data.mode === 'Simulation' ? 'Demo' : volSettingsRes.data.mode;
      setAssignmentMode(modeVal);
      setSimulationDelay(volSettingsRes.data.delay_seconds);
      setSimulatePeak(volSettingsRes.data.peak_hour === 1);
      setSystemMode(systemModeRes.data.system_mode || 'Demo');
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  useEffect(() => {
    fetchVolunteerSettings();
  }, []);

  const handleUpdateSettings = async (mode: 'Demo' | 'Production', delay: number) => {
    setSettingsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/admin/volunteer-mode', {
        mode: mode,
        delay_seconds: delay,
        peak_hour: simulatePeak ? 1 : 0
      });
      setAssignmentMode(mode);
      setSimulationDelay(delay);
      setSuccess('Volunteer Assignment Mode updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Failed to save volunteer assignment settings.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateSystemMode = async (mode: 'Demo' | 'Live') => {
    const isConfirmed = window.confirm(
      `Warning: Switching the Operating Mode to ${mode} will completely purge all active event data (attendees, scans, alerts, and dispatches). Do you want to proceed?`
    );
    if (!isConfirmed) return;

    setSettingsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/admin/system-mode', { system_mode: mode });
      setSystemMode(mode);
      setSuccess(`System Operating Mode switched to ${mode} Mode.`);
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Failed to update System Operating Mode.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!apiUrl.trim()) {
      setError('API Server link cannot be blank.');
      return;
    }
    setApiBaseUrl(apiUrl.trim());
    setSuccess('API Redirect link successfully updated.');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleTogglePeak = async (checked: boolean) => {
    setSimulatePeak(checked);
    localStorage.setItem('crowdshield_simulate_peak', String(checked));
    try {
      await api.post('/admin/volunteer-mode', {
        mode: assignmentMode,
        delay_seconds: simulationDelay,
        peak_hour: checked ? 1 : 0
      });
      setSuccess(`Simulator Peak Hour mode set to: ${checked ? 'ACTIVE' : 'INACTIVE'}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to sync Peak Hour mode with the server.');
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleReseedDb = async () => {
    const isConfirmed = window.confirm(
      'WARNING: Reseeding will clear all active database additions and restore the system tables back to default clean values. Are you sure you want to proceed?'
    );
    if (!isConfirmed) return;

    setError(null);
    setSuccess(null);
    setIsReseeding(true);

    try {
      const response = await api.post('/system/reseed');
      if (response.data && response.data.status === 'success') {
        setSuccess('Relational SQLite tables successfully re-initialized and seeded.');
      } else {
        setError('Failed to seed relational SQLite database.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Seeding failed. Server may be offline.');
    } finally {
      setIsReseeding(false);
      setTimeout(() => setSuccess(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Platform Settings</h2>
        <p className="text-sm text-slate-400">Configure global simulator parameters, backend redirection links, and seed operations.</p>
      </div>

      {/* Message banners */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="space-y-6">
        
        {/* Card 1: Simulation control */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
          <h3 className="font-outfit font-bold text-slate-100 text-base mb-2 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <span>Simulation Control Center</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">Manage live crowd generation parameters and peak-hour traffic multipliers.</p>
          
          <div className="p-4 rounded-xl border border-slate-850 bg-slate-950/40 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={simulatePeak}
                onChange={(e) => handleTogglePeak(e.target.checked)}
                className="mt-1 rounded border-slate-800 text-primary focus:ring-0 focus:ring-offset-0 bg-slate-900"
              />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Simulate Event Peak-Hour Traffic Multipliers</span>
                <span className="text-[10px] text-slate-500 font-medium">Toggles Peak Hour = 1 across all live AI risk evaluation matrices.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Card 1B: Volunteer Assignment Workflow Control */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
          <h3 className="font-outfit font-bold text-slate-100 text-base mb-2 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>Volunteer Assignment Workflow Control</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Configure how volunteer dispatches are processed: Demo Mode runs automatically for demo presentations, whereas Production Mode routes pending accept/reject decisions directly to volunteers.
          </p>

          <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-slate-850 bg-slate-950/40">
            {/* Read-Only Status Info */}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Demo Mode Active (Managed via Simulation)
            </span>
            
            {/* Delay configuration input */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Auto-Transition Delay:</span>
              <select
                value={simulationDelay}
                disabled={settingsLoading}
                onChange={(e) => handleUpdateSettings('Demo', Number(e.target.value))}
                className="bg-slate-950 text-slate-300 text-xs rounded border border-slate-800 p-1.5 font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value={2}>2 seconds</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 1C: System Operating Mode */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
          <h3 className="font-outfit font-bold text-slate-100 text-base mb-2 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <span>System Operating Mode</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Switch between Demo Mode (using automatic simulated workflows) and Live Mode (requires manual check-ins and dispatches).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              systemMode === 'Demo' 
                ? 'bg-amber-500/10 border-amber-500/30' 
                : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
            }`}>
              <input
                type="radio"
                name="systemMode"
                value="Demo"
                checked={systemMode === 'Demo'}
                onChange={() => handleUpdateSystemMode('Demo')}
                className="mt-1 text-amber-500 focus:ring-0/0 bg-slate-900"
              />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Demo Mode</span>
                <span className="text-[10px] text-slate-500 font-medium leading-relaxed">Automatic simulation workflows, auto attendance, auto travel, auto completion.</span>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              systemMode === 'Live' 
                ? 'bg-indigo-500/10 border-indigo-500/30' 
                : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
            }`}>
              <input
                type="radio"
                name="systemMode"
                value="Live"
                checked={systemMode === 'Live'}
                onChange={() => handleUpdateSystemMode('Live')}
                className="mt-1 text-indigo-500 focus:ring-0/0 bg-slate-900"
              />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Live Mode</span>
                <span className="text-[10px] text-slate-500 font-medium leading-relaxed">Manual volunteer workflows. No auto attendance or auto completion.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Card 2: Port redirector */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
          <h3 className="font-outfit font-bold text-slate-100 text-base mb-2 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-secondary" />
            <span>Core API Connection Redirection</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">Direct the frontend to point to alternative FastAPI backend servers.</p>
          
          <form onSubmit={handleUpdateUrl} className="flex gap-4 items-end max-w-lg">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">FastAPI Server Address</label>
              <input
                type="text"
                required
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="e.g. http://127.0.0.1:8000"
                className="w-full px-3.5 py-2 text-xs bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all h-9"
            >
              Update Link
            </button>
          </form>
        </div>

        {/* Card 3: Database seeding */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
          <h3 className="font-outfit font-bold text-slate-100 text-base mb-2 flex items-center gap-2">
            <Database className="w-5 h-5 text-warning" />
            <span>Platform System Seed Operations</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">Reset and restore original SQLite database tables to default summit baselines.</p>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-rose-500/15 bg-rose-500/5 text-xs text-rose-300 leading-relaxed font-semibold">
              Warning: Reseeding will clear all live database additions, registered volunteers, custom alerts, and check-in history.
            </div>
            
            <button
              onClick={handleReseedDb}
              disabled={isReseeding}
              className="px-4 py-2.5 bg-rose-500 hover:bg-rose-650 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-500/10 border border-rose-500/30 flex items-center gap-2"
            >
              {isReseeding ? (
                <>
                  <span className="w-3.5 h-3.5 border border-t-transparent border-white rounded-full animate-spin" />
                  <span>Reseeding Database...</span>
                </>
              ) : (
                <span>Reset &amp; Seed Relational Database</span>
              )}
            </button>
          </div>
        </div>

        {/* Card 4: Profile */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
          <h3 className="font-outfit font-bold text-slate-100 text-base mb-2 flex items-center gap-2">
            <User className="w-5 h-5 text-success" />
            <span>Profile Registry</span>
          </h3>
          <p className="text-xs text-slate-500 mb-6">View credentials and active role details for the current session.</p>

          <div className="grid grid-cols-2 gap-6 max-w-lg text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Full Name</span>
              <span className="font-bold text-slate-100 block bg-slate-950/40 p-2.5 rounded border border-slate-850">{user?.full_name || 'Guest'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Role Type</span>
              <span className="font-bold text-slate-100 block bg-slate-950/40 p-2.5 rounded border border-slate-850 capitalize">{user?.role || 'Guest'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Username</span>
              <span className="font-bold text-slate-400 block bg-slate-950/40 p-2.5 rounded border border-slate-850 font-mono">{user?.username || 'guest'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Email Contact</span>
              <span className="font-bold text-slate-400 block bg-slate-950/40 p-2.5 rounded border border-slate-850 font-mono">{user?.email || 'N/A'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default Settings;