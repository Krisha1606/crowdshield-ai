import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Clock, User, DoorOpen, AlertTriangle, AlertCircle,
  Sparkles, RefreshCw, Award, CheckCircle, FileText,
  CheckSquare, Megaphone, ChevronRight, Zap, Activity, X
} from 'lucide-react';
import api from '../services/api';
import { VolunteerAssignment, VolunteerPerformance, AssignmentRequest, VolunteerAlertAnnouncement } from '../types';
import { VolunteerHeroIllustration } from '../components/CrowdShieldIllustrations';
import { getGateActionText, getGateActionStyle } from '../utils/ux';

// ── Animated ring progress for operator score ─────────────────────────────────
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const r = 42; const circ = 2 * Math.PI * r;
  const filled = circ * (Math.min(score, 100) / 100);
  const color = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="7"
          strokeDasharray={`${filled} ${circ}`} strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="900"
          fill={color} fontFamily="Plus Jakarta Sans">{score || '—'}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="8" fontWeight="700"
          fill="#64748B" fontFamily="Plus Jakarta Sans">/ 100</text>
      </svg>
    </div>
  );
};

// ── Occupancy fill bar ────────────────────────────────────────────────────────
const FillBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1.5">
      <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const VolunteerDashboard: React.FC = () => {
  const [assignment, setAssignment] = useState<VolunteerAssignment | null>(null);
  const [performance, setPerformance] = useState<VolunteerPerformance | null>(null);
  const [requests, setRequests] = useState<AssignmentRequest[]>([]);
  const [alerts, setAlerts] = useState<VolunteerAlertAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const [prevRequestsCount, setPrevRequestsCount] = useState<number | null>(null);
  const [prevGateName, setPrevGateName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [prevAlerts, setPrevAlerts] = useState<VolunteerAlertAnnouncement[]>([]);

  const [systemMode, setSystemMode] = useState<string>('Demo');
  const [attendance, setAttendance] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00h 00m 00s');

  const fetchData = async () => {
    try {
      setError(null);
      const [assignmentRes, performanceRes, requestsRes, alertsRes, attendanceRes, modeRes] = await Promise.all([
        api.get('/volunteers/my-assignment'),
        api.get('/volunteers/performance'),
        api.get('/volunteers/my-requests'),
        api.get('/volunteers/my-alerts'),
        api.get('/attendance/status').catch(() => ({ data: { is_checked_in: false, check_in_time: null } })),
        api.get('/system/mode').catch(() => ({ data: { system_mode: 'Demo' } }))
      ]);
      setAssignment(assignmentRes.data);
      setPerformance(performanceRes.data);
      setRequests(requestsRes.data);
      setAlerts(alertsRes.data);
      setAttendance(attendanceRes.data);
      setSystemMode(modeRes.data.system_mode || 'Demo');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch dashboard data. Please try again.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    let interval: any = null;
    if (attendance?.is_checked_in && attendance?.check_in_time) {
      const tick = () => {
        const checkInStr = attendance.check_in_time.replace(/-/g, '/');
        const checkIn = new Date(checkInStr);
        const diffMs = Math.max(0, new Date().getTime() - checkIn.getTime());
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        setElapsedTime(`${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`);
      };
      tick();
      interval = setInterval(tick, 1000);
    } else {
      setElapsedTime('00h 00m 00s');
    }
    return () => clearInterval(interval);
  }, [attendance]);

  const handleAcceptRequest = async (requestId: number) => {
    try {
      setError(null);
      await api.post(`/volunteers/requests/${requestId}/accept`);
      await fetchData();
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to accept redeployment request.");
    }
  };

  const handleArriveRequest = async (requestId: number) => {
    try {
      setError(null);
      await api.post(`/volunteers/requests/${requestId}/arrive`);
      await fetchData();
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to verify arrival at gate.");
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      setError(null);
      await api.post(`/volunteers/requests/${requestId}/reject`);
      await fetchData();
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to reject redeployment request.");
    }
  };

  const handleAcknowledgeAnnouncement = async (annId: number) => {
    try {
      await api.post(`/announcements/${annId}/acknowledge`);
      setAlerts(prev => prev.map(a => a.type === 'announcement' && a.id === annId ? { ...a, is_read: true } : a));
    } catch (err) {
      console.error("Failed to acknowledge announcement", err);
    }
  };

  const handleAcknowledgeNotification = async (notifId: number) => {
    try {
      await api.post(`/volunteers/notifications/${notifId}/acknowledge`);
      await fetchData();
    } catch (err) {
      console.error("Failed to acknowledge notification", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const delay = requests.length > 0 ? 3000 : 10000;
    const interval = setInterval(() => {
      setRefreshing(true);
      fetchData();
    }, delay);
    return () => clearInterval(interval);
  }, [requests.length]);

  // Initial setup after loading completes
  useEffect(() => {
    if (!loading && prevRequestsCount === null && prevGateName === null) {
      setPrevRequestsCount(requests.length);
      setPrevGateName(assignment?.gate_name || "");
    }
  }, [loading, requests.length, assignment?.gate_name, prevRequestsCount, prevGateName]);

  // Monitor for new pending requests
  useEffect(() => {
    if (loading || prevRequestsCount === null) return;

    if (requests.length > prevRequestsCount) {
      const newRequest = requests[0];
      if (newRequest && newRequest.status === 'Pending') {
        setToastMessage(`New Assignment: Move to ${newRequest.to_gate_name}`);
      }
    }
    setPrevRequestsCount(requests.length);
  }, [requests, loading, prevRequestsCount]);

  // Monitor for assignment gate updates (e.g. accepted)
  useEffect(() => {
    if (loading || prevGateName === null) return;

    const currentGate = assignment?.gate_name || "";
    if (currentGate && prevGateName && currentGate !== prevGateName) {
      const volName = assignment?.volunteer_name || 'Volunteer';
      setToastMessage(`${volName} accepted assignment`);
      localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
    }
    setPrevGateName(currentGate);
  }, [assignment?.gate_name, assignment?.volunteer_name, loading, prevGateName]);

  // Auto-hide toast alerts
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Monitor active gate alerts for new alerts or resolved ones
  useEffect(() => {
    if (loading) return;

    const currentAlerts = alerts.filter(a => a.type === 'alert');
    const oldAlerts = prevAlerts.filter(pa => pa.type === 'alert');

    if (prevAlerts.length > 0 || currentAlerts.length > 0) {
      // Check for new alerts
      const newAlertsList = currentAlerts.filter(a => !oldAlerts.some(pa => pa.id === a.id));
      if (newAlertsList.length > 0) {
        const latest = newAlertsList[0];
        setToastMessage(`NEW ALERT: [${latest.alert_type}] ${latest.message}`);
      }

      // Check for resolved alerts
      const resolvedAlertsList = oldAlerts.filter(pa => !currentAlerts.some(a => a.id === pa.id));
      if (resolvedAlertsList.length > 0) {
        const latestResolved = resolvedAlertsList[0];
        setToastMessage(`RESOLVED: [${latestResolved.alert_type}] alert has been cleared.`);
      }
    }

    setPrevAlerts(alerts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, loading]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const getRecommendations = (status: any) => {
    if (!status) return [{ text: 'Check in at your station to begin receiving live updates.', level: 'info' }];
    const recs: { text: string; level: string }[] = [];
    if (status.predicted_risk === 'Dangerous' || status.congestion_status === 'High') {
      recs.push({ text: 'CRITICAL: Foyer congestion is high! Implement emergency routing immediately.', level: 'critical' });
      recs.push({ text: 'Direct overflow traffic to alternative entrances.', level: 'critical' });
    } else if (status.predicted_risk === 'Warning' || status.congestion_status === 'Medium') {
      recs.push({ text: 'Flow rates are rising. Open secondary queue lanes now.', level: 'warning' });
      recs.push({ text: 'Verify scanner connections to ensure steady intake.', level: 'warning' });
    } else {
      recs.push({ text: 'Foyer flow is normal. Continue scanning at steady pace.', level: 'ok' });
      recs.push({ text: 'Maintain barrier alignments for orderly line formation.', level: 'ok' });
    }
    if (status.predicted_wait_time > 4.0)
      recs.push({ text: `Wait time is high (${status.predicted_wait_time}m). Request additional scanner staff.`, level: 'warning' });
    return recs;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="relative w-16 h-16 mb-5">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
          <Shield className="absolute inset-0 m-auto w-7 h-7 text-primary" />
        </div>
        <p className="text-sm text-slate-400 font-semibold">Loading duty portal data...</p>
      </div>
    );
  }

  const liveGate = assignment?.live_gate_status;
  const recommendations = getRecommendations(liveGate);
  const score = performance?.operator_score || 90;
  const pct = liveGate ? Math.round((liveGate.current_occupancy / liveGate.max_capacity) * 100) : 0;
  const riskColor = liveGate?.predicted_risk === 'Dangerous' ? 'text-red-400 bg-red-500/10 border-red-500/25'
    : liveGate?.predicted_risk === 'Warning' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
    : 'text-green-400 bg-green-500/10 border-green-500/25';

  return (
    <div className="space-y-5">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/25 bg-slate-950/90 glass text-xs font-bold text-slate-100 shadow-2xl shadow-primary/20 min-w-[280px]">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Zap className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-1">
              <span className="block text-[10px] font-black uppercase text-primary tracking-wider">Operational Alert</span>
              <span className="mt-0.5 text-slate-200 block font-semibold">{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 🔔 Pending Assignment Request Banner */}
      {requests.length > 0 && requests[0].status === 'Pending' && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse-slow relative z-10 shadow-depth-1">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 mt-0.5 sm:mt-0">
              <Megaphone className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-400 font-outfit">Urgently Proposing Gate Redeployment</h4>
              <p className="text-xs text-slate-350 mt-0.5 leading-relaxed font-semibold">
                AI has detected crowd deficits. Move from <strong className="text-slate-200">{requests[0].from_gate_name}</strong> to <strong className="text-primary">{requests[0].to_gate_name}</strong>.
                <span className="block mt-1 text-[11px] text-slate-450 font-medium">Reason: {requests[0].reason}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => handleRejectRequest(requests[0].request_id)}
              className="px-3.5 py-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition-all"
            >
              Decline
            </button>
            <button
              onClick={() => handleAcceptRequest(requests[0].request_id)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-amber-500/15 hover:shadow-amber-500/25"
            >
              Accept &amp; Dispatch
            </button>
          </div>
        </div>
      )}

      {/* 🏃 En Route Transit Mode Banner */}
      {requests.length > 0 && (requests[0].status === 'Accepted' || requests[0].status === 'En Route') && (
        <div className="rounded-3xl border border-primary/30 bg-primary/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 shadow-depth-1">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary mt-0.5 sm:mt-0 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-primary font-outfit">En Route to Station</h4>
              <p className="text-xs text-slate-350 mt-0.5 leading-relaxed font-semibold">
                Please proceed to <strong className="text-primary">{requests[0].to_gate_name}</strong>. Mark your arrival as soon as you reach the station.
                <span className="block mt-1 text-[11px] text-slate-450 font-medium">Redeploying from: {requests[0].from_gate_name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => handleArriveRequest(requests[0].request_id)}
              className="px-4 py-2 bg-primary hover:bg-blue-650 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-primary/15 hover:shadow-primary/25 flex items-center gap-2"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Arrived At Gate</span>
            </button>
          </div>
        </div>
      )}

      {/* 🎉 Arrived / Initializing Duty Banner */}
      {requests.length > 0 && requests[0].status === 'Arrived' && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 shadow-depth-1 animate-pulse-slow">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-500 mt-0.5 sm:mt-0 animate-pulse">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-400 font-outfit">Arrived at Gate</h4>
              <p className="text-xs text-slate-350 mt-0.5 leading-relaxed font-semibold">
                You have arrived at <strong className="text-emerald-400">{requests[0].to_gate_name}</strong>. Initializing duty and updating system metrics...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/15 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Arrived. Starting duty...
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MERGED HEADER + QUICK ACTIONS
          ══════════════════════════════════════════════════════ */}
      <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden relative z-10">

        {/* Header row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-app-card-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-outfit text-lg font-black text-app-text tracking-tight">Duty Operations Portal</h2>
                {systemMode === 'Live' ? (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-extrabold text-indigo-400 uppercase tracking-wider">
                    Live Mode
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[9px] font-extrabold text-amber-400 uppercase tracking-wider">
                    Demo Mode
                  </span>
                )}
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase tracking-wider
                  ${assignment?.duty_status === 'Active'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    : 'bg-slate-100 dark:bg-slate-900 border-app-card-border text-slate-500'}`}>
                  <span className={`w-1 h-1 rounded-full ${assignment?.duty_status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {assignment?.duty_status || 'Off Duty'}
                </span>
                {assignment?.duty_status === 'Active' && (
                  <select
                    value={assignment?.status || 'Available'}
                    onChange={async (e) => {
                      try {
                        await api.post('/volunteers/my-status', { status: e.target.value });
                        await fetchData();
                        localStorage.setItem('crowdshield_sync_trigger', Date.now().toString());
                      } catch (err) {
                        console.error("Failed to update status", err);
                      }
                    }}
                    className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase bg-slate-950 focus:outline-none cursor-pointer ${
                      assignment?.status === 'Available' ? 'border-green-500/30 text-green-400' :
                      assignment?.status === 'Busy' ? 'border-red-500/30 text-red-400' :
                      assignment?.status === 'Break' ? 'border-amber-500/30 text-amber-400' :
                      'border-slate-700 text-slate-500'
                    }`}
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="Break">On Break</option>
                  </select>
                )}
                {error && <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-extrabold text-red-400 uppercase animate-pulse">Error</span>}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Welcome back, <span className="text-primary font-bold">{assignment?.volunteer_name || 'Officer'}</span> · Live gate metrics below
              </p>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-app-card border border-app-card-border hover:border-primary/30 hover:text-primary text-app-text-muted text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex-shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-3 divide-x divide-app-card-border">
          {[
            { icon: <CheckSquare className="w-4 h-4" />, label: 'Submit Checklist', sub: 'Safety tasks',    path: '/volunteer/checklist',     color: '#6366f1' },
            { icon: <AlertTriangle className="w-4 h-4" />, label: 'Report Incident', sub: 'File field report', path: '/volunteer/incidents',  color: '#ef4444' },
            { icon: <Megaphone className="w-4 h-4" />,    label: 'View Bulletins',  sub: 'Announcements',  path: '/volunteer/announcements', color: '#f59e0b' },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)}
              className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors text-left group">
              <div className="p-2 rounded-xl transition-transform group-hover:scale-110" style={{ background: `${action.color}15`, color: action.color }}>
                {action.icon}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-xs font-bold text-app-text truncate">{action.label}</p>
                <p className="text-[10px] text-slate-500 font-semibold">{action.sub}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform ml-auto" />
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN GRID
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">

        {/* ── Left Column: Assignment + Performance ── */}
        <div className="space-y-5">

          {/* Assignment Brief Card */}
          <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-app-card-border flex items-center justify-between">
              <h3 className="font-outfit font-black text-app-text text-sm flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-primary" />
                My Assignment Brief
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border
                ${assignment?.duty_status === 'Active' ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : assignment?.duty_status === 'Completed' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {assignment?.duty_status || 'Off Duty'}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl bg-primary/5 border border-primary/15">
                <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/25">
                  <DoorOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Assigned Gate</p>
                  <p className="text-base font-black text-app-text">{assignment?.gate_name || 'Unassigned'}</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: <Clock className="w-3.5 h-3.5" />, label: 'Shift Hours', value: assignment?.shift_timing || '—' },
                  { icon: <Shield className="w-3.5 h-3.5" />, label: 'Security Role', value: assignment?.role || '—' },
                  { icon: <User className="w-3.5 h-3.5" />, label: 'Gate Supervisor', value: assignment?.supervisor_name || '—' },
                  { icon: <FileText className="w-3.5 h-3.5" />, label: 'Contact Info', value: assignment?.contact || '—' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-app-card-border last:border-0">
                    <span className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                      <span className="text-slate-400">{row.icon}</span>
                      {row.label}
                    </span>
                    <span className="text-xs font-bold text-app-text truncate max-w-[120px] text-right">{row.value}</span>
                  </div>
                ))}
                {attendance?.is_checked_in && (
                  <div className="flex items-center justify-between py-2.5 border-t border-app-card-border mt-2 pt-2">
                    <span className="flex items-center gap-2 text-xs text-emerald-500 font-bold animate-pulse">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      Active Shift Timer
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-400 tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">{elapsedTime}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Performance Card */}
          <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-app-card-border">
              <h3 className="font-outfit font-black text-app-text text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Performance Log
              </h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-5 mb-4">
                <ScoreRing score={score} />
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Operator Score</p>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">Based on shifts, checklists & incident response rate.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Checklists', val: performance?.checklists_submitted || 0, color: 'text-primary' },
                  { label: 'Incidents', val: performance?.incidents_filed || 0, color: 'text-red-400' },
                  { label: 'Shifts', val: performance?.shifts_completed || 0, color: 'text-emerald-400' },
                ].map((s, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-app-card-border">
                    <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right 2 Columns: Live Gate + AI Guidance ── */}
        <div className="lg:col-span-2 space-y-5">

          {liveGate ? (
            <>
              {/* Live Gate Sensors Panel */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-app-card-border flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-outfit font-black text-app-text text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-secondary" />
                      Live Gate Sensors
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{liveGate.gate_name}</p>
                  </div>
                  <span className={`text-[9px] font-black px-3 py-1.5 rounded border ${getGateActionStyle(liveGate.predicted_risk, liveGate.deficit || 0)}`}>
                    Action: {getGateActionText(liveGate.predicted_risk, liveGate.deficit || 0)}
                  </span>
                </div>
                <div className="p-5">
                  {/* Occupancy % full-width bar */}
                  <div className="mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-app-card-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-app-text">Occupancy %</span>
                      <span className="text-sm font-black text-primary">{pct}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold">{liveGate.current_occupancy} present</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{liveGate.max_capacity} max</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'AI Risk Level', value: liveGate.predicted_risk, color: liveGate.predicted_risk === 'Dangerous' ? 'text-red-600 dark:text-red-400' : liveGate.predicted_risk === 'Warning' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Crowd Congestion', value: liveGate.congestion_status, color: liveGate.congestion_status === 'High' ? 'text-red-600 dark:text-red-400' : liveGate.congestion_status === 'Medium' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Predicted Wait Time', value: `${liveGate.predicted_wait_time} mins`, color: 'text-slate-200' },
                    ].map((m, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-app-card-border flex flex-col justify-between">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">{m.label}</p>
                        <p className={`text-sm font-black ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Recommendations Panel */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-app-card-border flex items-center justify-between">
                  <h3 className="font-outfit font-black text-app-text text-sm flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>
                    AI Operations Guidance
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Real-Time
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  {recommendations.map((rec, i) => (
                    <div key={i} className={`relative pl-4 pr-4 py-3 rounded-xl border text-xs font-semibold leading-relaxed flex items-start gap-3 overflow-hidden
                      ${rec.level === 'critical' ? 'bg-red-500/5 border-red-500/20 text-red-200'
                      : rec.level === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-200'
                      : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'}`}>
                      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-xl
                        ${rec.level === 'critical' ? 'bg-red-500' : rec.level === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                      <span className="flex-shrink-0 mt-0.5">
                        {rec.level === 'critical' ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : rec.level === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        )}
                      </span>
                      <p className="text-slate-300 dark:text-slate-300 font-semibold leading-relaxed">{rec.text}</p>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-app-card-border pt-3 mt-2">
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                    <span>Recommendations update automatically with live sensor data.</span>
                  </div>
                </div>
              </div>

              {/* Alerts & Bulletins Feed */}
              <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-app-card-border flex items-center justify-between">
                  <h3 className="font-outfit font-black text-app-text text-sm flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <Megaphone className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    Bulletins &amp; Gate Alerts
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">
                    {alerts.length} Active
                  </span>
                </div>
                <div className="p-5 space-y-4 max-h-[350px] overflow-y-auto divide-y divide-app-card-border/60">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6 font-semibold">No active alerts or bulletins for your station.</p>
                  ) : (
                    alerts.map((item, idx) => (
                      <div key={idx} className="pt-4 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                            item.type === 'alert'
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              : item.type === 'notification'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                              : item.priority === 'High'
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                              : 'bg-primary/10 border-primary/20 text-primary'
                          }`}>
                            {item.type === 'alert' ? `${item.alert_type}` : item.type === 'notification' ? `${item.notification_type}` : `Announcement (${item.priority})`}
                          </span>
                          
                          <span className="text-[9px] text-slate-500 font-mono font-medium">{item.time}</span>
                        </div>
                        
                        {item.type === 'alert' ? (
                          <>
                            <p className="text-xs font-bold text-slate-200">{item.message}</p>
                            {item.recommendation && (
                              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-app-card-border mt-1">
                                <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                                  <span className="text-primary font-bold uppercase tracking-wider text-[9px] mr-1">Action Protocol:</span> 
                                  {item.recommendation}
                                </p>
                              </div>
                            )}
                          </>
                        ) : item.type === 'notification' ? (
                          <>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h5 className="text-xs font-black text-slate-200">{item.title}</h5>
                                <p className="text-[11px] text-slate-450 mt-0.5 leading-relaxed font-bold">{item.message}</p>
                              </div>
                              <button
                                onClick={() => handleAcknowledgeNotification(item.id)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-450 hover:text-white text-[10px] font-extrabold rounded-lg transition-all flex-shrink-0 cursor-pointer"
                              >
                                Acknowledge
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h5 className="text-xs font-black text-slate-200">{item.title}</h5>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-medium">{item.message}</p>
                              </div>
                              {!item.is_read && (
                                <button
                                  onClick={() => handleAcknowledgeAnnouncement(item.id)}
                                  className="px-2.5 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary hover:text-white text-[10px] font-extrabold rounded-lg transition-all flex-shrink-0 cursor-pointer"
                                >
                                  Mark Read
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-900 border border-app-card-border flex items-center justify-center mb-5">
                <AlertCircle className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-app-text mb-2">No Active Gate Assignment</h3>
              <p className="text-xs text-slate-400 max-w-sm font-semibold leading-relaxed">
                You must be assigned to an active gate by a System Administrator to view live grid metrics and real-time AI recommendations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolunteerDashboard;
