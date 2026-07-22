import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, DoorOpen, AlertTriangle, Clock, UserCheck,
  ShieldCheck, RefreshCw, Shield, Activity, ArrowRight, Zap,
  TrendingUp, TrendingDown, Play, Square, Pause, Database, Wifi
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import api, { getApiBaseUrl } from '../services/api';
import type { Event, Gate, Volunteer, Alert, Incident } from '../types';
import { GateCard } from '../components/GateCard';
import { DashboardHeroIllustration } from '../components/CrowdShieldIllustrations';
import { getRiskColor, getRiskBadge, getRecommendationBadge, getGateActionText } from '../utils/ux';
import { useLiveData } from '../hooks/useLiveData';


// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
      else prev.current = target;
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

// ─── Radial Safety Gauge ─────────────────────────────────────────────────────
const SafetyGauge: React.FC<{ score: number; label: string; color: string }> = ({ score, label, color }) => {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * (score / 100);
  const colorMap: Record<string, string> = {
    'text-success': '#22C55E',
    'text-warning': '#F59E0B',
    'text-danger': '#EF4444',
  };
  const stroke = colorMap[color] || '#22C55E';
  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stroke} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          className="text-slate-800 dark:text-slate-800" strokeOpacity="0.25" />
        {/* Score arc */}
        <circle cx="64" cy="64" r={r} fill="none" stroke="url(#gauge-grad)" strokeWidth="8"
          strokeDasharray={`${filled} ${circumference}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Center score */}
        <text x="64" y="60" textAnchor="middle" fontSize="24" fontWeight="800"
          fill={stroke} fontFamily="Plus Jakarta Sans, sans-serif">{score}</text>
        <text x="64" y="76" textAnchor="middle" fontSize="10" fontWeight="700"
          fill="#64748B" fontFamily="Plus Jakarta Sans, sans-serif">/ 100</text>
      </svg>
      <span className={`text-xs font-extrabold tracking-widest uppercase px-3 py-1 rounded-full border mt-2
        ${color === 'text-success' ? 'border-green-500/25 bg-green-500/10 text-green-400' :
          color === 'text-warning' ? 'border-amber-500/25 bg-amber-500/10 text-amber-400' :
          'border-red-500/25 bg-red-500/10 text-red-400'}`}>
        {label}
      </span>
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; accent: string; trend?: 'up' | 'down' | 'neutral';
  trendVal?: string;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, accent, trend, trendVal }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-app-card border border-app-card-border 
    hover:border-${accent}/40 hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 
    shadow-depth-1 group cursor-default`}>
    {/* Gradient top accent line */}
    <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-${accent} to-transparent opacity-60 group-hover:opacity-100 transition-opacity`} />
    {/* Glow blob */}
    <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-${accent}/8 blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
    <div className="p-5 relative z-10">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-xl bg-${accent}/10 text-${accent} shadow-sm`}>{icon}</div>
      </div>
      <p className="font-outfit text-2xl font-extrabold text-app-text mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-500 font-bold">{sub}</p>
        {trend && trendVal && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
            {trendVal}
          </span>
        )}
      </div>
    </div>
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-app-card border border-app-card-border rounded-xl px-4 py-3 shadow-depth-2 text-xs">
      <p className="text-app-text font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>{p.name}: <span className="text-app-text">{p.value}</span></p>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const {
    gates: liveGates,
    gatesMetrics: liveGatesMetrics,
    isSimulating: liveIsSimulating,
    systemMode: liveSystemMode,
    startSimulation: liveStartSimulation,
    pauseSimulation: livePauseSimulation,
    restartSimulation: liveRestartSimulation
  } = useLiveData();

  const [events, setEvents] = useState<Event[]>([]);
  const [stateGatesMetrics, setGatesMetrics] = useState<Gate[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const gatesMetrics = liveGatesMetrics.length > 0 ? liveGatesMetrics : stateGatesMetrics;
  const isSimulating = liveIsSimulating;
  const systemMode = liveSystemMode;

  const getPhotoUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${getApiBaseUrl()}/${url}`;
  };

  const handleDownloadImage = async (photoUrl: string) => {
    try {
      const fullUrl = getPhotoUrl(photoUrl);
      const resp = await fetch(fullUrl);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photoUrl.split('/').pop() || 'incident_photo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(getPhotoUrl(photoUrl), '_blank');
    }
  };

  const fetchData = async () => {
    setError(null);
    try {
      const [eventsRes, gatesRes, volsRes, alertsRes, simRes, incidentsRes, modeRes] = await Promise.all([
        api.get('/events'),
        api.get('/gates/metrics'),
        api.get('/volunteers'),
        api.get('/alerts'),
        api.get('/simulation/status'),
        api.get('/incidents'),
        api.get('/system/mode').catch(() => ({ data: { system_mode: 'Demo' } }))
      ]);
      setEvents(eventsRes.data);
      setGatesMetrics(gatesRes.data);
      setVolunteers(volsRes.data);
      setAlerts(alertsRes.data);
      setIncidents(incidentsRes.data || []);
      setLastSync(new Date());
    } catch (err: any) {
      setError('Unable to synchronize live metrics. Please check FastAPI backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    setActionLoading(true);
    try {
      await liveStartSimulation();
    } catch (err: any) {
      setError(err?.message || 'Failed to start simulation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopSimulation = async () => {
    setActionLoading(true);
    try {
      await livePauseSimulation();
    } catch (err: any) {
      setError(err?.message || 'Failed to pause simulation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestartSimulation = async () => {
    setActionLoading(true);
    try {
      await liveRestartSimulation();
    } catch (err: any) {
      setError(err?.message || 'Failed to restart simulation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveIncident = async (incidentId: number) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/incidents/${incidentId}/resolve`);
      await fetchData();
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
    } catch (err: any) {
      setError('Failed to resolve incident. Check backend connection.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crowdshield_sync_trigger') {
        fetchData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ─── All hooks must be called before any early returns ───────────────────
  const totalAttendeesCheckedInEarly = gatesMetrics.reduce((s, g) => s + g.current_occupancy, 0);
  const totalVenueCapacityEarly = gatesMetrics.reduce((s, g) => s + g.max_capacity, 0);
  const avgOccupancyEarly = totalVenueCapacityEarly > 0 ? Math.round((totalAttendeesCheckedInEarly / totalVenueCapacityEarly) * 100) : 0;
  const animCheckedIn = useCountUp(totalAttendeesCheckedInEarly);
  const animOccupancy = useCountUp(avgOccupancyEarly);

  if (isLoading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16 mb-5">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
          <Shield className="absolute inset-0 m-auto w-7 h-7 text-primary" />
        </div>
        <p className="text-sm text-slate-400 font-semibold font-outfit">Syncing live dashboard feeds...</p>
      </div>
    );
  }

  // ─── Calculations ────────────────────────────────────────────────────────
  const totalEvents = events.length;
  const totalAttendeesCheckedIn = gatesMetrics.reduce((s, g) => s + g.current_occupancy, 0);
  const totalVenueCapacity = gatesMetrics.reduce((s, g) => s + g.max_capacity, 0);
  const avgOccupancyPercentage = totalVenueCapacity > 0 ? Math.round((totalAttendeesCheckedIn / totalVenueCapacity) * 100) : 0;
  const activeAlertsCount = alerts.filter(a => a.is_resolved === 0).length;
  const avgWaitTime = gatesMetrics.length > 0 ? (gatesMetrics.reduce((s, g) => s + g.predicted_wait_time, 0) / gatesMetrics.length).toFixed(1) : '0.0';
  const maxWaitTime = gatesMetrics.length > 0 ? Math.max(...gatesMetrics.map(g => g.predicted_wait_time)) : 0;
  const totalRequiredVolunteers = gatesMetrics.reduce((s, g) => s + g.required_volunteers, 0);
  const totalStationedVolunteers = volunteers.filter(v => v.assigned_gate !== null).length;
  const riskDistribution = {
    Safe: gatesMetrics.filter(g => g.predicted_risk === 'Safe').length,
    Warning: gatesMetrics.filter(g => g.predicted_risk === 'Warning').length,
    Dangerous: gatesMetrics.filter(g => g.predicted_risk === 'Dangerous').length,
  };
  const safetyScore = gatesMetrics[0]?.safety_score ?? 100;
  const safetyLabel = gatesMetrics[0]?.safety_label ?? 'OPTIMAL';
  const safetyColor = gatesMetrics[0]?.safety_color ?? 'text-success';
  const occupancyChartData = gatesMetrics.map(g => ({
    name: g.gate_name.replace(' Entrance', '').replace(' Gate', ''),
    Occupancy: g.current_occupancy, Capacity: g.max_capacity
  }));
  const queueChartData = gatesMetrics.map(g => ({
    name: g.gate_name.replace(' Entrance', '').replace(' Gate', ''),
    Queue: g.queue_length, Wait: g.predicted_wait_time
  }));
  const riskPieData = [
    { name: 'Safe', value: riskDistribution.Safe, color: '#22C55E' },
    { name: 'Warning', value: riskDistribution.Warning, color: '#F59E0B' },
    { name: 'Dangerous', value: riskDistribution.Dangerous, color: '#EF4444' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 relative pb-4">

      {error && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold animate-pulse relative z-20">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[10px] uppercase font-extrabold hover:underline tracking-wider cursor-pointer ml-4 flex-shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MERGED HEADER + KPI SECTION
      ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden relative z-10">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-app-card-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/8 border border-primary/15">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-outfit text-lg font-bold text-app-text tracking-tight">Foyer Operations Control</h2>
                {systemMode === 'Live' ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-extrabold text-indigo-400 uppercase tracking-wider animate-pulse">
                    <Zap className="w-2.5 h-2.5" />
                    Live Mode
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-extrabold text-emerald-500 uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Demo Mode
                  </span>
                )}
                {systemMode === 'Demo' && (isSimulating ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-extrabold text-blue-400 uppercase tracking-wider animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                    Simulating
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-[9px] font-extrabold text-slate-400 tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-slate-500" />
                    Sim Idle
                  </span>
                ))}
                {error && <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-extrabold text-red-400 uppercase animate-pulse">Offline</span>}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Real-time telemetry · crowd density · safety dispatch feeds</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-slate-500 font-semibold hidden lg:block">{lastSync.toLocaleTimeString()}</span>
            
            {systemMode === 'Demo' && (
              <>
                {isSimulating ? (
                  <button onClick={handleStopSimulation} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                    <Pause className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                    Pause Simulation
                  </button>
                ) : (
                  <button onClick={handleStartSimulation} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                    <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                    Start Simulation
                  </button>
                )}

                <button onClick={handleRestartSimulation} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  Restart Simulation
                </button>
              </>
            )}

            <button onClick={fetchData}
              className="flex items-center gap-2 px-3.5 py-2 bg-app-card border border-app-card-border hover:border-primary/30 hover:text-primary text-app-text-muted text-xs font-bold rounded-xl transition-all cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </button>
            <button onClick={() => navigate('/analytics')}
              className="flex items-center gap-2 px-3.5 py-2 bg-app-card border border-app-card-border hover:border-primary/30 hover:text-primary text-app-text-muted text-xs font-bold rounded-xl transition-all cursor-pointer">
              <TrendingUp className="w-3.5 h-3.5" />
              Analytics
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        {gatesMetrics.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-sm">
            No active telemetry feeds. Check server logs.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-app-card-border">
            {[
              { label: 'Live Events',   value: totalEvents,            sub: 'Schedules',      icon: <Calendar className="w-4 h-4" />,   color: '#6366f1' },
              { label: 'Checked In',   value: animCheckedIn,           sub: 'Attendees',      icon: <Users className="w-4 h-4" />,      color: '#06b6d4' },
              { label: 'Occupancy %',  value: `${animOccupancy}%`,     sub: 'Cap Ratio',      icon: <DoorOpen className="w-4 h-4" />,   color: '#22c55e' },
              { label: 'Active Alerts',value: activeAlertsCount,       sub: 'Dispatched',     icon: <AlertTriangle className="w-4 h-4" />,color: '#ef4444' },
              { label: 'Predicted Wait Time', value: `${avgWaitTime}m`, sub: `Max ${maxWaitTime}m`, icon: <Clock className="w-4 h-4" />, color: '#f59e0b' },
              { label: 'Recommended Volunteers', value: totalRequiredVolunteers, sub: `${totalStationedVolunteers} deployed`, icon: <UserCheck className="w-4 h-4" />, color: '#8b5cf6' },
            ].map((kpi, i) => (
              <div key={i} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                  <div className="p-1.5 rounded-lg" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                    {kpi.icon}
                  </div>
                </div>
                <p className="font-outfit text-xl font-extrabold text-app-text">{kpi.value}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* MAIN ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">

        {/* Left 2/3: Charts */}
        <div className="lg:col-span-2 space-y-5">

              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-app-card-border">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.7)' }} />
                    <h3 className="font-outfit font-bold text-app-text text-sm">Gate Occupancy vs. Capacity</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" /><span className="text-[10px] text-slate-500 font-semibold">Occupancy</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" /><span className="text-[10px] text-slate-500 font-semibold">Capacity</span>
                  </div>
                </div>
                <div className="px-4 pb-5 pt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyChartData} barGap={4} barSize={28}>
                      <defs>
                        <linearGradient id="db-occ" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.6" />
                        </linearGradient>
                        <linearGradient id="db-cap" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(99,102,241,0.08)" strokeDasharray="none" />
                      <XAxis dataKey="name" stroke="#8891a8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                      <YAxis stroke="#8891a8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)', radius: 8 }} />
                      <Bar dataKey="Occupancy" fill="url(#db-occ)" radius={[8,8,0,0]} style={{ filter: 'drop-shadow(0 4px 10px rgba(99,102,241,0.3))' }} />
                      <Bar dataKey="Capacity" fill="url(#db-cap)" radius={[8,8,0,0]} style={{ filter: 'drop-shadow(0 4px 10px rgba(52,211,153,0.2))' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Area Chart: Queue & Wait */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-app-card-border">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                    <h3 className="font-outfit font-bold text-app-text text-sm">Queue Size & Wait Time Predictions</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-slate-400"><span className="w-3 h-1 rounded bg-cyan-400 inline-block"/>Wait</span>
                    <span className="flex items-center gap-1 text-slate-400"><span className="w-3 h-1 rounded bg-orange-400 inline-block"/>Queue</span>
                  </div>
                </div>
                <div className="px-4 pb-4 pt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={queueChartData}>
                      <defs>
                        <linearGradient id="colorWait" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity="0.3" />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="colorQueue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F97316" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:[stroke:#1E293B]" opacity={0.5} />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="Wait" stroke="#06B6D4" strokeWidth={2.5} fill="url(#colorWait)" />
                      <Area type="monotone" dataKey="Queue" stroke="#F97316" strokeWidth={2.5} fill="url(#colorQueue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gate Status Table */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b border-app-card-border flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="font-outfit font-bold text-app-text text-sm">Live Gate Status Board</h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gatesMetrics.length === 0 ? (
                    <p className="col-span-full p-6 text-center text-xs text-slate-500 font-semibold">No gates reporting.</p>
                  ) : gatesMetrics.map((gate) => {
                    const pct = Math.round((gate.current_occupancy / gate.max_capacity) * 100);
                    return (
                       <GateCard
                        key={gate.gate_id}
                        gateName={gate.gate_name}
                        predictedRisk={gate.predicted_risk}
                        congestionLevel={gate.congestion_level}
                        occupancyPercentage={pct}
                        queueLength={gate.queue_length}
                        predictedWaitTime={gate.predicted_wait_time}
                        deficit={gate.deficit}
                        requiredVolunteers={gate.required_volunteers}
                        volunteers={gate.volunteers}
                        pendingCount={gate.pending_count ?? 0}
                        acceptedCount={gate.accepted_count ?? 0}
                        enrouteCount={gate.enroute_count ?? 0}
                        arrivedCount={gate.arrived_count ?? 0}
                        inTransitCount={gate.in_transit_count ?? 0}
                        effectiveStaff={gate.effective_staff}
                        remainingDeficit={gate.remaining_deficit ?? gate.effective_deficit ?? 0}
                        dispatchStatus={gate.dispatch_status}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 1/3: Safety + Risk + Alerts */}
            <div className="space-y-5">

              {/* Safety Score Gauge */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 p-6 flex flex-col items-center">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-3">Overall Safety Index</p>
                <SafetyGauge score={safetyScore} label={safetyLabel} color={safetyColor} />
                <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
                  <div className="p-2 rounded-xl bg-green-500/5 border border-green-500/15">
                    <p className="text-sm font-bold text-green-400">{riskDistribution.Safe}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Safe</p>
                  </div>
                  <div className="p-2 rounded-xl bg-orange-500/5 border border-orange-500/15">
                    <p className="text-sm font-bold text-orange-400">{riskDistribution.Warning}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Warning</p>
                  </div>
                  <div className="p-2 rounded-xl bg-red-500/5 border border-red-500/15">
                    <p className="text-sm font-bold text-red-400">{riskDistribution.Dangerous}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Dangerous</p>
                  </div>
                </div>
              </div>

              {/* Risk Distribution Pie */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 p-5">
                <h3 className="font-outfit font-bold text-app-text text-sm mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Predicted Risk Distribution
                </h3>
                <div className="h-40 relative flex items-center justify-center">
                  {riskPieData.length === 0 ? (
                    <span className="text-xs text-slate-500 font-semibold">No risk metrics available</span>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                            paddingAngle={6} dataKey="value">
                            {riskPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', borderRadius: '12px', fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center pointer-events-none">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Gates</span>
                        <span className="text-xl font-bold text-app-text font-outfit">{gatesMetrics.length}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Alerts Feed */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-app-card-border">
                  <h3 className="font-outfit font-bold text-app-text text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Safety Alerts
                  </h3>
                  <button onClick={() => navigate('/alerts')}
                    className="text-[10px] text-primary font-bold hover:underline uppercase tracking-wider flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 font-bold border border-dashed border-app-card-border rounded-2xl">
                      🟢 All gates stable. No active alerts.
                    </div>
                  ) : alerts.slice(0, 4).map((al) => {
                    const gateInfo = gatesMetrics.find(g => g.gate_id === al.gate_id);
                    const isCritical = al.alert_type === 'Emergency' || al.alert_type === 'Congestion';
                    return (
                      <div key={al.alert_id}
                        className={`relative pl-3 pr-3 py-3 rounded-xl border text-xs overflow-hidden
                          ${isCritical ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                        <div className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${isCritical ? 'bg-red-500' : 'bg-amber-400'}`} />
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`font-extrabold ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                            {al.alert_type}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{al.alert_time.split(' ')[1] || al.alert_time}</span>
                        </div>
                        <p className="text-[11px] font-bold text-app-text-muted">{gateInfo?.gate_name || `Gate #${al.gate_id}`}</p>
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5">{al.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Field Incidents Feed */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden mt-6">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-app-card-border">
                  <h3 className="font-outfit font-bold text-app-text text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                    Field Incidents
                  </h3>
                  <span className="text-[10px] bg-red-500/10 text-red-400 font-extrabold px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wider">
                    {incidents.filter(inc => !inc.is_resolved).length} Active
                  </span>
                </div>
                <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
                  {incidents.filter(inc => !inc.is_resolved).length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 font-bold border border-dashed border-app-card-border rounded-2xl">
                      🟢 No active field incidents reported.
                    </div>
                  ) : incidents.filter(inc => !inc.is_resolved).map((inc) => {
                    const isCrit = inc.severity === 'Critical' || inc.severity === 'High';
                    return (
                      <div key={inc.incident_id}
                        className={`relative pl-3 pr-3 py-3 rounded-xl border text-xs overflow-hidden ${
                          isCrit ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <div className={`absolute inset-y-0 left-0 w-1 ${isCrit ? 'bg-red-500' : 'bg-amber-400'}`} />
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`font-extrabold ${isCrit ? 'text-red-400' : 'text-amber-400'}`}>
                            {inc.incident_type} ({inc.severity})
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {inc.created_at ? new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-app-text-muted">Loc: {inc.location}</p>
                        <p className="text-[10px] text-slate-550 font-semibold leading-relaxed mt-1">
                          {inc.description}
                        </p>
                        <p className="text-[9px] text-slate-500 font-medium mt-1">Reported by: {inc.volunteer_name}</p>
                        
                        {inc.photo_url ? (
                          <div className="mt-2.5 flex items-center gap-3">
                            <img 
                              src={getPhotoUrl(inc.photo_url)} 
                              alt="Incident attachment" 
                              className="w-16 h-16 object-cover rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                              onClick={() => setEnlargedImage(getPhotoUrl(inc.photo_url))}
                              title="Click to enlarge"
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => setEnlargedImage(getPhotoUrl(inc.photo_url))}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold text-left transition-colors cursor-pointer"
                              >
                                🔍 Click to enlarge
                              </button>
                              <a 
                                href={getPhotoUrl(inc.photo_url)} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[10px] text-slate-400 hover:text-slate-300 font-bold transition-colors"
                              >
                                ↗ Open in new tab
                              </a>
                              <button 
                                onClick={() => handleDownloadImage(inc.photo_url!)}
                                className="text-[10px] text-slate-400 hover:text-slate-300 text-left font-bold transition-colors cursor-pointer"
                              >
                                ⬇ Download image
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 py-1.5 px-3 bg-slate-950/40 rounded border border-dashed border-app-card-border text-[10px] text-slate-500 font-bold w-max">
                            📷 No Photo
                          </div>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-app-card-border flex justify-end">
                          <button
                            onClick={() => inc.incident_id && handleResolveIncident(inc.incident_id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-green-500 hover:bg-green-600 text-slate-950 font-black text-[9px] rounded-lg transition-all uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

        </div>
      </div>

      {enlargedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-4xl max-h-[85vh] bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden p-3 shadow-2xl flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full transition-colors font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            <img src={enlargedImage} alt="Enlarged view" className="max-w-full max-h-[70vh] object-contain rounded-lg border border-slate-800" />
            <div className="mt-4 flex justify-between gap-4 w-full px-2 text-xs">
              <a 
                href={enlargedImage} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors font-bold"
              >
                ↗ Open in New Tab
              </a>
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = enlargedImage;
                  link.download = enlargedImage.split('/').pop() || 'download';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-slate-950 rounded-lg transition-colors font-bold cursor-pointer"
              >
                ⬇ Download Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;