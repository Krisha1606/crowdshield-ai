import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, ShieldAlert, ArrowRight, Zap,
  RefreshCw, AlertTriangle, CheckCircle, X, Activity,
  Clock, MapPin, ChevronDown, ChevronUp, UserCog,
  MoveRight, Info, Check, Sparkles
} from 'lucide-react';
import api from '../services/api';
import { GateAssignment, AssignmentRequest } from '../types';
import { getGateActionText } from '../utils/ux';
import { GateCard as SharedGateCard } from '../components/GateCard';

const FILTER_TABS = [
  { key: 'all',       label: 'All Gates' },
  { key: 'deficit',   label: 'Deficit Gates' },
  { key: 'overloaded',label: 'Overloaded Gates' },
  { key: 'balanced',  label: 'Balanced Gates' },
];

const renderEscalationStatus = (status: string) => {
  switch (status) {
    case 'Situation Resolved':
      return (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
          Situation Resolved
        </span>
      );
    case 'Escalation Required':
      return (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse">
          Escalation Required
        </span>
      );
    case 'Additional Volunteers Required':
    default:
      return (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-350 border border-yellow-500/20">
          Additional Volunteers Required
        </span>
      );
  }
};

// Gate Card wrapper for Volunteer page
const GateCard: React.FC<{ gate: GateAssignment; onExpand: () => void; expanded: boolean }> = ({
  gate, onExpand, expanded
}) => {
  const cleanDeficit = Math.max(gate.deficit, 0);

  return (
    <SharedGateCard
      gateName={gate.gate_name}
      predictedRisk={gate.risk as 'Safe' | 'Warning' | 'Dangerous'}
      congestionLevel={gate.congestion as 'Low' | 'Medium' | 'High'}
      occupancyPercentage={gate.occupancy_pct}
      queueLength={gate.queue_length}
      predictedWaitTime={gate.waiting_time}
      deficit={cleanDeficit}
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
      headerExtra={
        <div className="flex items-center gap-1.5 flex-wrap">
          {renderEscalationStatus(gate.escalation_status)}
          {cleanDeficit > 0 ? (
            <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-red-500/15 text-red-500 border border-red-500/25 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              -{cleanDeficit}
            </span>
          ) : gate.surplus > 0 ? (
            <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/15 text-emerald-600 border border-emerald-500/25">
              <CheckCircle className="w-3.5 h-3.5" />
              +{gate.surplus}
            </span>
          ) : (
            <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/15">
              <CheckCircle className="w-3.5 h-3.5" />
              OK
            </span>
          )}
        </div>
      }
      footerExtra={
        <>
          {gate.suggested_moves && gate.suggested_moves.length > 0 && (
            <>
              <div className="border-t border-black/10 dark:border-white/10 pt-3">
                <button
                  onClick={onExpand}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MoveRight className="w-3.5 h-3.5 text-primary" />
                    AI Redeployment Dispatches ({gate.suggested_moves.length})
                  </span>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {expanded && (
                <div className="pt-3 space-y-2">
                  {gate.suggested_moves.map((move, i) => (
                    <div
                      key={move.volunteer_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-850"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                        <span className="text-[9px] font-black text-primary">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{move.volunteer_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-500 truncate max-w-[110px]">{move.from_gate}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="text-[10px] text-slate-400 font-bold truncate">{gate.gate_name.split(' – ')[0]}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1 text-[9px] text-slate-500 font-bold">
                        <MapPin className="w-3 h-3" />
                        d={move.distance_score}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {(!gate.suggested_moves || gate.suggested_moves.length === 0) && cleanDeficit === 0 && (
            <div className="border-t border-black/10 dark:border-white/10 pt-3">
              <p className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                Gate fully staffed. No redeployment suggestion required.
              </p>
            </div>
          )}
        </>
      }
    />
  );
};

export const VolunteerAssignments: React.FC = () => {
  const [gates, setGates]             = useState<GateAssignment[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [filter, setFilter]           = useState('all');
  const [error, setError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [expandedGates, setExpandedGates] = useState<Set<number>>(new Set());

  const [isSimulating, setIsSimulating] = useState(false);
  const [simPhase, setSimPhase]       = useState<string>('Normal');

  const [activeDispatches, setActiveDispatches] = useState<AssignmentRequest[]>([]);
  const [completedDispatches, setCompletedDispatches] = useState<AssignmentRequest[]>([]);

  const fetchDeficits = useCallback(async () => {
    try {
      const res = await api.get('/volunteers/deficits');
      const gatesList = res.data.gates || res.data;
      setGates(gatesList);

      const monRes = await api.get('/admin/volunteer-monitoring');
      const reqList: AssignmentRequest[] = monRes.data.assignment_requests || [];

      const active = reqList.filter(r => ['Pending', 'Accepted', 'Arrived'].includes(r.status));
      const completed = reqList.filter(r => r.status === 'Completed').slice(0, 8);

      setActiveDispatches(active);
      setCompletedDispatches(completed);

      const simStatusRes = await api.get('/simulation/status');
      setIsSimulating(simStatusRes.data.active);
      setSimPhase(simStatusRes.data.phase || 'Normal');

      setError(null);
    } catch {
      setError('Failed to fetch volunteer redeployment dispatches. Backend might be offline.');
    }
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    await fetchDeficits();
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crowdshield_sync_trigger') {
        fetchDeficits();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchDeficits]);

  useEffect(() => {
    const hasActiveDispatches = activeDispatches.length > 0;
    const intervalTime = isSimulating ? 3000 : (hasActiveDispatches ? 3500 : 8000);
    const interval = setInterval(fetchDeficits, intervalTime);
    return () => clearInterval(interval);
  }, [activeDispatches, isSimulating, fetchDeficits]);

  const toggleExpand = (gateId: number) => {
    setExpandedGates(prev => {
      const next = new Set(prev);
      next.has(gateId) ? next.delete(gateId) : next.add(gateId);
      return next;
    });
  };

  const totalVols       = gates.reduce((s, g) => s + g.stationed_volunteers, 0);
  const deficitGates    = gates.filter(g => Math.max(g.deficit, 0) > 0).length;
  const overloadedGates = gates.filter(g => g.overload).length;
  const movable         = gates.reduce((s, g) => s + g.surplus, 0);

  const stats = [
    { label: 'Volunteers Stationed', value: totalVols,       color: 'text-blue-400',    icon: <Users className="w-4 h-4" /> },
    { label: 'Gates in Deficit',     value: deficitGates,    color: 'text-red-400',     icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Overloaded Stations',  value: overloadedGates, color: 'text-orange-400',  icon: <ShieldAlert className="w-4 h-4" /> },
    { label: 'Surplus Crew Pool',    value: movable,         color: 'text-emerald-400', icon: <UserCheck className="w-4 h-4" /> },
  ];

  const filteredGates = gates.filter(g => {
    if (filter === 'all')        return true;
    if (filter === 'deficit')    return Math.max(g.deficit, 0) > 0;
    if (filter === 'overloaded') return g.overload;
    if (filter === 'balanced')   return Math.max(g.deficit, 0) === 0 && !g.overload;
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/15 border border-primary/25">
                <UserCog className="w-6 h-6 text-primary animate-pulse" />
              </div>
              Volunteer Auto-Assignment Monitoring
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSimulating ? (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-450 uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Simulation Running
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-805 text-xs font-black text-slate-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Simulation Stopped
            </span>
          )}

          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-slate-355 border border-slate-805 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 glass flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-slate-800/60 ${s.color}`}>{s.icon}</div>
            <div>
              <p className={`text-xl font-black font-outfit leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout: Deficit Gates + Dispatches Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column (2/3): Deficit Gates list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  filter === tab.key
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                    : 'text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-350 bg-slate-900/50'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {deficitGates === 0 && !isLoading && (
              <div className="ml-auto flex items-center gap-2 text-xs text-emerald-455 font-bold">
                <Check className="w-4 h-4 text-emerald-500" />
                All gates fully staffed.
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 border border-slate-850 rounded-2xl bg-slate-900/10">
              <div className="w-10 h-10 border-2 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Evaluating gate metrics...</p>
            </div>
          ) : filteredGates.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-950/20">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">No gates matching current filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGates.map(gate => (
                <GateCard
                  key={gate.gate_id}
                  gate={gate}
                  onExpand={() => toggleExpand(gate.gate_id)}
                  expanded={expandedGates.has(gate.gate_id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar (1/3): Active Dispatches + Situation Improvement */}
        <div className="space-y-6">

          {/* Active Redeployments Panel */}
          <div className="space-y-3">
            <h3 className="font-outfit font-black text-slate-200 text-xs uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary animate-pulse" />
              Active Redeployments ({activeDispatches.length})
            </h3>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3 min-h-[160px] max-h-[350px] overflow-y-auto backdrop-blur-md">
              {activeDispatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-xl">💤</span>
                  <p className="text-[10px] text-slate-550 font-bold uppercase mt-2">No active dispatches currently moving</p>
                </div>
              ) : (
                activeDispatches.map((req) => (
                  <div key={req.request_id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-100">{req.volunteer_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                        req.status === 'Arrived' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400 animate-pulse' :
                        req.status === 'Accepted' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-455' :
                        req.status === 'Pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse' :
                        'bg-slate-850 border-slate-700 text-slate-500'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                      <span className="truncate max-w-[80px]">{req.from_gate_name || "Reserve"}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="truncate text-slate-200">{req.to_gate_name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Situation Improvement Panel — PART 2 CLEAN DISPLAY */}
          <div className="space-y-3">
            <h3 className="font-outfit font-black text-slate-200 text-xs uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              Situation Improvement ({completedDispatches.length})
            </h3>

            <div className="rounded-2xl border border-slate-850 bg-slate-900/25 p-4 space-y-3 max-h-[500px] overflow-y-auto backdrop-blur-md">
              {completedDispatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">No dispatches completed recently</p>
                </div>
              ) : (
                completedDispatches.map((req) => (
                  <div key={req.request_id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2 hover:border-slate-800 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-100">{req.volunteer_name}</span>
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {req.status || 'Completed'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                      <span>Source: <strong className="text-slate-300">{req.from_gate_name || "Reserve Pool"}</strong></span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Dest: <strong className="text-emerald-400">{req.to_gate_name}</strong></span>
                    </div>

                    {req.reason && (
                      <p className="text-[9px] text-slate-500 font-medium truncate pt-1 border-t border-slate-900">
                        Reason: {req.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Legend */}
      {!isLoading && (
        <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/30 flex flex-wrap gap-4 text-[9px] text-slate-500 font-black uppercase tracking-wider">
          <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Legend (AI Risk Level):</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            Dangerous
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            Warning
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Safe
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            <MapPin className="w-3.5 h-3.5" /> d = zone distance score
          </span>
        </div>
      )}
    </div>
  );
};

export default VolunteerAssignments;
