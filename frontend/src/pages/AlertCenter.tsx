import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, AlertTriangle, Trash2, Send, CheckCircle, X,
  PlusCircle, AlertCircle, Zap, ShieldAlert, Clock,
  Users, RefreshCw, Filter, ChevronDown, ChevronUp,
  TrendingUp, Activity, UserCheck
} from 'lucide-react';
import api from '../services/api';
import { Alert, Gate } from '../types';
import { getGateActionText, getGateActionStyle } from '../utils/ux';

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  Critical: {
    bg: 'bg-red-500/8',
    border: 'border-red-500/35',
    text: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
  },
  High: {
    bg: 'bg-red-500/8',
    border: 'border-red-500/35',
    text: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
  },
  Medium: {
    bg: 'bg-orange-500/8',
    border: 'border-orange-500/35',
    text: 'text-orange-400',
    badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    dot: 'bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
  },
  Low: {
    bg: 'bg-success/8',
    border: 'border-success/35',
    text: 'text-success',
    badge: 'bg-success/10 text-success border border-success/20',
    dot: 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]',
  },
};


const TYPE_ICONS: Record<string, React.ReactNode> = {
  'Congestion Alert':  <TrendingUp className="w-4 h-4" />,
  'High Risk Alert':   <ShieldAlert className="w-4 h-4" />,
  'Waiting Time Alert':<Clock className="w-4 h-4" />,
  'Volunteer Shortage':<Users className="w-4 h-4" />,
  'Congestion':        <TrendingUp className="w-4 h-4" />,
  'Emergency':         <ShieldAlert className="w-4 h-4" />,
  'Security':          <ShieldAlert className="w-4 h-4" />,
  'Staff Notification': <UserCheck className="w-4 h-4" />,
};

const FILTER_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'active',     label: 'Active' },
  { key: 'resolved',   label: 'Resolved' },
  { key: 'Critical',   label: 'Critical' },
  { key: 'High',       label: 'High' },
  { key: 'Congestion Alert',   label: 'Congestion' },
  { key: 'High Risk Alert',    label: 'Risk' },
  { key: 'Volunteer Shortage', label: 'Volunteer' },
  { key: 'Waiting Time Alert', label: 'Wait Time' },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export const AlertCenter: React.FC = () => {
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [gates, setGates]         = useState<Gate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter]       = useState('active');
  const [error, setError]         = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);

  // Form fields
  const [gateId, setGateId]       = useState<number | ''>('');
  const [alertType, setAlertType] = useState('Congestion Alert');
  const [severity, setSeverity]   = useState('Medium');
  const [message, setMessage]     = useState('');
  const [recommendation, setRecommendation] = useState('');

  // Announcement fields
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annTitle, setAnnTitle]       = useState('');
  const [annPriority, setAnnPriority] = useState('Medium');
  const [annMessage, setAnnMessage]   = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
      setError(null);
    } catch {
      setError('Unable to load alert feed. Check backend connection.');
    }
  }, []);

  const fetchGates = useCallback(async () => {
    try {
      const res = await api.get('/gates');
      setGates(res.data);
    } catch { /* silent */ }
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchAlerts(), fetchGates()]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const handleSyncTrigger = () => {
      fetchAlerts();
    };
    window.addEventListener('storage', handleSyncTrigger);
    window.addEventListener('crowdshield_sync_trigger', handleSyncTrigger);
    return () => {
      window.removeEventListener('storage', handleSyncTrigger);
      window.removeEventListener('crowdshield_sync_trigger', handleSyncTrigger);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleGenerateAlerts = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/alerts/generate');
      setSuccessMsg(res.data.message);
      await fetchAlerts();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      setError('ML alert generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResolve = async (id: number) => {
    setError(null);
    try {
      await api.post(`/alerts/${id}/resolve`);
      setSuccessMsg(`Alert #${id} marked as resolved.`);
      await fetchAlerts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setError('Failed to resolve alert.');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/alerts/${id}`);
      setSuccessMsg(`Alert #${id} permanently deleted.`);
      await fetchAlerts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setError('Failed to delete alert.');
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!gateId || !message.trim()) {
      setError('Please select a gate and enter a message.');
      return;
    }
    try {
      await api.post('/alerts', {
        gate_id: Number(gateId),
        alert_type: alertType,
        severity,
        message: message.trim(),
        recommendation: recommendation.trim(),
      });
      setSuccessMsg('Alert dispatched successfully.');
      setGateId(''); setMessage(''); setRecommendation('');
      await fetchAlerts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setError('Failed to dispatch alert.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!annTitle.trim() || !annMessage.trim()) {
      setError('Please enter a title and message.');
      return;
    }
    try {
      await api.post('/announcements', {
        title: annTitle.trim(),
        message: annMessage.trim(),
        priority: annPriority,
      });
      setSuccessMsg('Announcement broadcasted successfully.');
      setAnnTitle(''); setAnnMessage('');
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setError('Failed to broadcast announcement.');
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = alerts.filter(a => {
    if (filter === 'all')      return true;
    if (filter === 'active')   return a.is_resolved === 0;
    if (filter === 'resolved') return a.is_resolved === 1;
    if (filter === 'Critical' || filter === 'High') return a.severity === filter && a.is_resolved === 0;
    return a.alert_type === filter && a.is_resolved === 0;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeAlerts   = alerts.filter(a => a.is_resolved === 0);
  const criticalAlerts = alerts.filter(a => a.severity === 'Critical' && a.is_resolved === 0);
  const resolvedAlerts = alerts.filter(a => a.is_resolved === 1);
  const mlAlerts       = alerts.filter(a =>
    ['Congestion Alert', 'High Risk Alert', 'Waiting Time Alert', 'Volunteer Shortage'].includes(a.alert_type)
  );

  const stats = [
    { label: 'Active Alerts',   value: activeAlerts.length,   color: 'text-red-400',    icon: <Bell className="w-4 h-4" /> },
    { label: 'Critical',        value: criticalAlerts.length,  color: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'ML Generated',    value: mlAlerts.length,        color: 'text-blue-400',   icon: <Zap className="w-4 h-4" /> },
    { label: 'Resolved',        value: resolvedAlerts.length,  color: 'text-green-400',  icon: <CheckCircle className="w-4 h-4" /> },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/25">
              <Bell className="w-6 h-6 text-red-400" />
            </div>
            Alert Center
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            ML-driven real-time safety alerts — congestion, risk, wait times &amp; volunteer shortages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-300 border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            id="generate-ml-alerts-btn"
            onClick={handleGenerateAlerts}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-blue-600 border border-primary/40 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-60"
          >
            {isGenerating
              ? <><div className="w-3.5 h-3.5 border-2 border-t-white border-white/30 rounded-full animate-spin" /><span>Scanning...</span></>
              : <><Zap className="w-4 h-4" /><span>Generate ML Alerts</span></>
            }
          </button>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/25 text-success text-xs font-semibold">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 glass flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-slate-800/60 ${s.color}`}>{s.icon}</div>
            <div>
              <p className={`text-xl font-bold font-outfit ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              filter === tab.key
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300 bg-slate-900/50'
            }`}
          >
            {tab.label}
            {tab.key === 'active' && activeAlerts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-red-500 text-white rounded-full font-bold">
                {activeAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Alerts Feed (2/3) ── */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-t-primary border-slate-800 rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-500 font-medium">Loading alert feed...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
              <div className="text-3xl mb-3">🟢</div>
              <p className="text-sm font-bold text-slate-400">No alerts match this filter</p>
              <p className="text-xs text-slate-600 mt-1">All gates are operating within safe parameters.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {filtered.map(al => {
                const sev = al.severity || 'Medium';
                const cfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.Medium;
                const icon = TYPE_ICONS[al.alert_type] || <Activity className="w-4 h-4" />;
                const resolved = al.is_resolved === 1;
                const isStaffNotif = al.alert_type === 'Staff Notification';

                return (
                  <div
                    key={al.alert_id}
                    className={`p-4 rounded-2xl border transition-all hover:-translate-y-0.5 ${
                      resolved
                        ? 'bg-slate-900/30 border-slate-800/60 opacity-60'
                        : isStaffNotif
                        ? 'bg-slate-850/40 border-slate-800 text-slate-350 shadow-md shadow-blue-500/5'
                        : `${cfg.bg} ${cfg.border}`
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Severity dot */}
                        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${resolved ? 'bg-slate-600' : isStaffNotif ? 'bg-blue-400' : cfg.dot}`} />
                        {/* Icon + type */}
                        <div className={`flex-shrink-0 ${resolved ? 'text-slate-500' : isStaffNotif ? 'text-blue-400' : cfg.text}`}>{icon}</div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <h4 className="font-outfit font-bold text-sm text-slate-100">{al.alert_type}</h4>
                            {/* Severity badge */}
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                              resolved ? 'bg-slate-800 text-slate-500 border-slate-700' : isStaffNotif ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : cfg.badge
                            }`}>
                              {resolved ? 'RESOLVED' : isStaffNotif ? 'STAFF' : sev.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                            <span>{al.gate_name}</span>
                            {al.gate_status && (
                              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${getGateActionStyle(al.gate_status, 0)}`}>
                                Action: {getGateActionText(al.gate_status, 0)}
                              </span>
                            )}
                            <span>&nbsp;·&nbsp; {al.alert_time?.slice(0, 16).replace('T', ' ')}</span>
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {!resolved && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            id={`resolve-alert-${al.alert_id}`}
                            onClick={() => handleResolve(al.alert_id)}
                            title="Mark Resolved"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-green-400 border border-green-500/30 hover:bg-green-500/15 rounded-lg transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Resolve</span>
                          </button>
                          <button
                            onClick={() => handleDelete(al.alert_id)}
                            title="Delete Alert"
                            className="p-1.5 border border-slate-800 hover:bg-red-500/15 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Message */}
                    <p className="text-xs text-slate-400 font-medium leading-relaxed mt-2.5 ml-[22px]">
                      {al.message}
                    </p>

                    {/* Recommendation */}
                    {al.recommendation && !resolved && (
                      <div className={`mt-3 ml-[22px] p-2.5 rounded-lg border ${
                        isStaffNotif ? 'bg-slate-800/25 border-slate-850' : `${cfg.bg} ${cfg.border}`
                      } flex items-start gap-2`}>
                        <Zap className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isStaffNotif ? 'text-blue-400' : cfg.text}`} />
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${isStaffNotif ? 'text-blue-400' : cfg.text}`}>
                            {isStaffNotif ? 'Protocol' : 'Recommendation'}
                          </p>
                          <p className="text-xs text-slate-300 font-medium leading-relaxed">{al.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="space-y-4">

          {/* Active Summary Card */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
            <h3 className="font-outfit font-bold text-slate-100 text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Live Status
            </h3>
            <div className="space-y-2.5">
              {(['Critical', 'High', 'Medium', 'Low'] as const).map(sev => {
                const cnt = activeAlerts.filter(a => a.severity === sev).length;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <div key={sev} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs text-slate-400 font-medium">{sev}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ML Alert Types */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
            <h3 className="font-outfit font-bold text-slate-100 text-sm mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Alert Types
            </h3>
            <div className="space-y-2">
              {[
                { type: 'Congestion Alert', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-orange-400' },
                { type: 'High Risk Alert', icon: <ShieldAlert className="w-3.5 h-3.5" />, color: 'text-red-400' },
                { type: 'Waiting Time Alert', icon: <Clock className="w-3.5 h-3.5" />, color: 'text-yellow-400' },
                { type: 'Volunteer Shortage', icon: <Users className="w-3.5 h-3.5" />, color: 'text-blue-400' },
              ].map(({ type, icon, color }) => {
                const cnt = activeAlerts.filter(a => a.alert_type === type).length;
                return (
                  <div key={type} className="flex items-center justify-between py-1">
                    <div className={`flex items-center gap-2 ${color}`}>
                      {icon}
                      <span className="text-xs text-slate-400 font-medium">{type}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Dispatch — Collapsible */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 glass overflow-hidden">
            <button
              onClick={() => setShowForm(v => !v)}
              className="w-full flex items-center justify-between p-5 text-sm font-bold text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-primary" />
                Manual Dispatch
              </span>
              {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showForm && (
              <form onSubmit={handleCreateAlert} className="px-5 pb-5 space-y-3 border-t border-slate-800">
                <div className="pt-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Gate</label>
                  <select
                    value={gateId}
                    onChange={e => setGateId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  >
                    <option value="">Select gate...</option>
                    {gates.map(g => (
                      <option key={g.gate_id} value={g.gate_id}>{g.gate_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Alert Type</label>
                  <select
                    value={alertType}
                    onChange={e => setAlertType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  >
                    <option>Congestion Alert</option>
                    <option>High Risk Alert</option>
                    <option>Waiting Time Alert</option>
                    <option>Volunteer Shortage</option>
                    <option>Emergency</option>
                    <option>Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Severity</label>
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  >
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Describe the issue..."
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Recommendation</label>
                  <textarea
                    value={recommendation}
                    onChange={e => setRecommendation(e.target.value)}
                    rows={2}
                    placeholder="Action to take..."
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-semibold text-white bg-primary hover:bg-blue-600 border border-primary/40 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch Alert
                </button>
              </form>
            )}
          </div>

          {/* Broadcast Announcement — Collapsible */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 glass overflow-hidden mt-4">
            <button
              onClick={() => setShowAnnForm(v => !v)}
              className="w-full flex items-center justify-between p-5 text-sm font-bold text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-amber-500" />
                Broadcast Announcement
              </span>
              {showAnnForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAnnForm && (
              <form onSubmit={handleCreateAnnouncement} className="px-5 pb-5 space-y-3 border-t border-slate-800">
                <div className="pt-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Announcement Title</label>
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    placeholder="e.g. Weather Warning, Shift Schedule Update"
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Priority</label>
                  <select
                    value={annPriority}
                    onChange={e => setAnnPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Message Body</label>
                  <textarea
                    required
                    value={annMessage}
                    onChange={e => setAnnMessage(e.target.value)}
                    rows={4}
                    placeholder="Broadcast message details to all volunteers..."
                    className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 border border-amber-500/40 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950 fill-current" />
                  Broadcast Bulletin
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertCenter;