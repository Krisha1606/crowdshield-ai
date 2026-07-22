import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  RadialBarChart, RadialBar, Legend, Cell
} from 'recharts';
import { BarChart3, Clock, TrafficCone, RefreshCw, Info, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { Gate } from '../types';

// ─── Premium Tooltip ──────────────────────────────────────────────────────────
const PremiumTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(13,15,26,0.95)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 14,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(12px)'
    }}>
      <p style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ color: '#8891a8', fontSize: 10, fontWeight: 600 }}>{p.name}:</span>
          <span style={{ color: '#eef0f8', fontSize: 11, fontWeight: 800 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Chart Card Wrapper ────────────────────────────────────────────────────────
const ChartCard: React.FC<{
  title: string; subtitle?: string; accentColor: string;
  children: React.ReactNode; legend?: { color: string; label: string }[];
}> = ({ title, subtitle, accentColor, children, legend }) => (
  <div className="relative rounded-3xl bg-app-card border border-app-card-border shadow-depth-2 overflow-hidden group">
    {/* gradient top accent */}
    <div className="absolute inset-x-0 top-0 h-0.5 opacity-80" style={{ background: accentColor }} />
    {/* subtle inner glow */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${accentColor}08 0%, transparent 70%)` }} />
    <div className="relative z-10 px-6 pt-6 pb-2 flex items-start justify-between">
      <div>
        <h3 className="font-outfit font-black text-app-text text-sm">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      {legend && (
        <div className="flex items-center gap-3">
          {legend.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}60` }} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="relative z-10 px-4 pb-6 pt-2 h-72">{children}</div>
  </div>
);

// ─── Stat Mini Card ────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="relative rounded-2xl bg-app-card border border-app-card-border shadow-depth-1 p-5 overflow-hidden hover:-translate-y-1 transition-all">
    <div className="absolute inset-x-0 top-0 h-0.5 opacity-70" style={{ background: color }} />
    <div className="flex items-start justify-between mb-2">
      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
        <div style={{ color }}>{icon}</div>
      </div>
    </div>
    <p className="font-outfit text-2xl font-black text-app-text">{value}</p>
  </div>
);

export const Analytics: React.FC = () => {
  const [gatesMetrics, setGatesMetrics] = useState<Gate[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'occupancy' | 'queues' | 'congestion'>('occupancy');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [gatesRes, histRes] = await Promise.all([
        api.get('/gates/metrics'),
        api.get('/analytics/historical?limit=50')
      ]);
      setGatesMetrics(gatesRes.data);
      setHistoricalLogs(histRes.data);
      setError(null);
    } catch (err: any) {
      setError('Unable to parse analytics registers from backend APIs.');
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const avgWait = gatesMetrics.length > 0
    ? (gatesMetrics.reduce((s, g) => s + g.predicted_wait_time, 0) / gatesMetrics.length).toFixed(1) : '0.0';
  const maxWait = gatesMetrics.length > 0 ? Math.max(...gatesMetrics.map(g => g.predicted_wait_time)) : 0;
  const bottleneckGate = gatesMetrics.length > 0
    ? gatesMetrics.reduce((p, c) => p.predicted_wait_time > c.predicted_wait_time ? p : c) : null;

  const shortName = (n: string) => n.replace(' Entrance', '').replace(' Gate', '').replace(' Foyer', '');

  const occupancyChartData = gatesMetrics.map(g => ({
    name: shortName(g.gate_name),
    Occupancy: g.current_occupancy,
    Capacity: g.max_capacity
  }));

  const waitChartData = gatesMetrics.map(g => ({
    name: shortName(g.gate_name),
    Wait: g.predicted_wait_time,
    Queue: g.queue_length
  }));

  const congestionBins = (() => {
    if (!historicalLogs.length) return [];
    const bins = Array(10).fill(0);
    historicalLogs.forEach(l => { const s = l.Congestion_Score || 0; bins[Math.min(Math.floor(s / 10), 9)]++; });
    return bins.map((count, i) => ({ range: `${i * 10}–${(i + 1) * 10}`, Count: count }));
  })();

  const rosterData = historicalLogs.slice(0, 40).map((l, i) => ({
    idx: i + 1, Queue: l.Queue_Length, Staff: l.Volunteers_Assigned
  }));

  const tabs = [
    { id: 'occupancy', label: 'Foyer Occupancy', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'queues',    label: 'Queue & Wait',    icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'congestion',label: 'Congestion',      icon: <TrafficCone className="w-3.5 h-3.5" /> },
  ];

  // Gradient IDs
  const ACCENT_INDIGO = 'linear-gradient(90deg,#6366f1,#818cf8)';
  const ACCENT_CYAN   = 'linear-gradient(90deg,#06b6d4,#38bdf8)';
  const ACCENT_VIOLET = 'linear-gradient(90deg,#8b5cf6,#a78bfa)';
  const ACCENT_AMBER  = 'linear-gradient(90deg,#f59e0b,#fcd34d)';

  const axisStyle = { stroke: '#8891a8', fontSize: 11, fontWeight: 600 };
  const gridStyle = { stroke: 'rgba(99,102,241,0.07)', strokeDasharray: 'none' };

  return (
    <div className="space-y-6 pb-4 relative">
      {/* ── Glow orbs ── */}
      <div className="glow-orb w-96 h-96 bg-indigo-500/15 -top-20 -left-10" />
      <div className="glow-orb w-64 h-64 bg-violet-500/15 bottom-0 right-0" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div>
          <h2 className="font-outfit text-3xl font-black text-app-text tracking-tight">Platform Analytics</h2>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">Deep-dive graphs mapping crowd trends, foyer loads, and model distributions.</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 bg-app-card border border-app-card-border hover:border-indigo-400/40 text-slate-500 hover:text-app-text text-xs font-bold rounded-xl transition-all shadow-depth-1">
          <RefreshCw className="w-3.5 h-3.5" />
          Synchronize Charts
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/8 border border-red-500/20 text-red-400 text-xs font-semibold relative z-10">
          {error}
        </div>
      )}

      {/* Premium Tab Bar */}
      <div className="relative z-10 flex gap-1 p-1 rounded-2xl bg-app-card border border-app-card-border shadow-depth-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-500 hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-800/50'}`}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 relative z-10">
          <div className="relative w-14 h-14 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
          </div>
          <p className="text-xs text-slate-500 font-semibold">Compiling analytics registers...</p>
        </div>
      ) : gatesMetrics.length === 0 ? (
        <div className="p-16 text-center rounded-3xl border border-dashed border-app-card-border bg-app-card text-slate-500 font-semibold relative z-10">
          No analytics data available.
        </div>
      ) : (
        <div className="space-y-6 relative z-10">

          {/* ═══════════ TAB 1: OCCUPANCY ═══════════ */}
          {activeTab === 'occupancy' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Chart A: Occupancy gradient bars */}
                <ChartCard title="Occupancy % by Gate" subtitle="Current live headcounts per entry point" accentColor="#6366f1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyChartData} barSize={36} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="occ-bar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.7" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} {...gridStyle} />
                      <XAxis dataKey="name" {...axisStyle} tickLine={false} axisLine={false} />
                      <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                      <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)', radius: 8 }} />
                      <Bar dataKey="Occupancy" fill="url(#occ-bar)" radius={[8, 8, 0, 0]}
                        style={{ filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.35))' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart B: Occupancy vs Capacity */}
                <ChartCard title="Occupancy % vs. Capacity" subtitle="Occupancy vs. max gate capacity comparison"
                  accentColor="#06b6d4"
                  legend={[{ color: '#818cf8', label: 'Occupancy %' }, { color: '#34d399', label: 'Capacity' }]}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyChartData} barGap={4} barSize={22} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="occ-b" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.5" />
                        </linearGradient>
                        <linearGradient id="cap-b" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} {...gridStyle} />
                      <XAxis dataKey="name" {...axisStyle} tickLine={false} axisLine={false} />
                      <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                      <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'rgba(6,182,212,0.05)', radius: 8 }} />
                      <Bar dataKey="Occupancy" fill="url(#occ-b)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Capacity"  fill="url(#cap-b)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

              </div>
            </div>
          )}

          {/* ═══════════ TAB 2: QUEUES & WAIT ═══════════ */}
          {activeTab === 'queues' && (
            <div className="space-y-5">

              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Predicted Wait Time (Avg)" value={`${avgWait} min`}
                  icon={<Clock className="w-4 h-4" />} color="#6366f1" />
                <StatCard label="Longest Wait Time (Max)" value={`${maxWait} min`}
                  icon={<AlertTriangle className="w-4 h-4" />} color="#f59e0b" />
                <StatCard label="Bottleneck Gate" value={bottleneckGate ? bottleneckGate.gate_name.split(' ').slice(0,2).join(' ') : 'None'}
                  icon={<TrendingUp className="w-4 h-4" />} color="#ef4444" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Chart A: Wait Time Area */}
                <ChartCard title="Predicted Gate Wait Times" subtitle="AI-forecasted foyer wait durations (minutes)" accentColor="#06b6d4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waitChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wait-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#06b6d4" stopOpacity="0.4" />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} {...gridStyle} />
                      <XAxis dataKey="name" {...axisStyle} tickLine={false} axisLine={false} />
                      <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                      <Tooltip content={<PremiumTooltip />} />
                      <Area type="monotone" dataKey="Wait" stroke="#22d3ee" strokeWidth={3}
                        fill="url(#wait-area)" dot={{ fill: '#22d3ee', r: 5, strokeWidth: 2, stroke: '#0d0f1a' }}
                        activeDot={{ r: 7, strokeWidth: 2, stroke: '#22d3ee' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart B: Historical Queue Line */}
                <ChartCard title="Historical Queue Trend" subtitle="Chronological queue depth from scan logs"
                  accentColor="#f59e0b"
                  legend={[{ color: '#fcd34d', label: 'Queue Length' }]}>
                  <ResponsiveContainer width="100%" height="100%">
                    {historicalLogs.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-500 text-xs font-semibold">Dataset offline</div>
                    ) : (
                      <AreaChart data={historicalLogs.slice(0, 50).map((l, i) => ({ idx: i + 1, Queue: l.Queue_Length }))}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="queue-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f59e0b" stopOpacity="0.35" />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} {...gridStyle} />
                        <XAxis dataKey="idx" {...axisStyle} tickLine={false} axisLine={false} />
                        <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                        <Tooltip content={<PremiumTooltip />} />
                        <Area type="monotone" dataKey="Queue" stroke="#fcd34d" strokeWidth={2.5}
                          fill="url(#queue-area)" dot={false} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>

              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: CONGESTION ═══════════ */}
          {activeTab === 'congestion' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Chart A: Congestion Distribution Area */}
                <ChartCard title="Congestion Score Distribution" subtitle="Historical crowd data composite index curve" accentColor="#ef4444">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={congestionBins} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cong-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"  stopColor="#f87171" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="cong-stroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%"  stopColor="#fca5a5" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} {...gridStyle} />
                      <XAxis dataKey="range" {...axisStyle} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                      <Tooltip content={<PremiumTooltip />} />
                      <Area type="monotone" dataKey="Count" stroke="url(#cong-stroke)" strokeWidth={3}
                        fill="url(#cong-area)"
                        dot={{ fill: '#f87171', r: 4, strokeWidth: 2, stroke: '#0d0f1a' }}
                        activeDot={{ r: 7 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart B: Volunteer Assignment vs Queue Size */}
                <ChartCard title="Volunteer Assignment vs. Queue Size" subtitle="Queue depth vs. volunteers assigned over time"
                  accentColor="#8b5cf6"
                  legend={[{ color: '#fcd34d', label: 'Queue Size' }, { color: '#818cf8', label: 'Current Volunteers' }]}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rosterData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="staff-line" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} {...gridStyle} />
                      <XAxis dataKey="idx" {...axisStyle} tickLine={false} axisLine={false} />
                      <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                      <Tooltip content={<PremiumTooltip />} />
                      <Line type="monotone" dataKey="Queue" stroke="#fcd34d" strokeWidth={2.5} dot={false}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(252,211,77,0.5))' }} />
                      <Line type="monotone" dataKey="Staff" stroke="#818cf8" strokeWidth={2.5} dot={false}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(129,140,248,0.5))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

              </div>

              {/* Info footnote */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 text-xs text-slate-500 relative z-10">
                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  The Congestion Score is a composite index weighted as:{' '}
                  <span className="text-indigo-400 font-bold">Score = (Queue_Length × 0.4) + (Occupancy_Percentage × 0.6)</span>.
                  Scores above 70 trigger automated warning flags and AI dispatch alerts.
                </span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default Analytics;