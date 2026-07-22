import React from 'react';
import { getGateActionText } from '../utils/ux';

interface GateCardProps {
  gateName: string;
  predictedRisk: 'Safe' | 'Warning' | 'Dangerous' | 'High' | 'Critical' | string;
  congestionLevel: 'Low' | 'Medium' | 'High';
  occupancyPercentage: number;
  queueLength?: number;
  predictedWaitTime: number;
  deficit: number;
  requiredVolunteers: number;
  headerExtra?: React.ReactNode;
  rightHeader?: React.ReactNode;
  footerExtra?: React.ReactNode;
  volunteers?: { volunteer_id: number; volunteer_name: string; contact: string }[];
  // Authoritative split transit counts from backend source of truth
  pendingCount?: number;
  acceptedCount?: number;
  enrouteCount?: number;
  arrivedCount?: number;
  inTransitCount?: number;
  effectiveStaff?: number;
  remainingDeficit?: number;
  dispatchStatus?: string;
}

export const GateCard: React.FC<GateCardProps> = ({
  gateName,
  predictedRisk,
  congestionLevel,
  occupancyPercentage,
  queueLength = 0,
  predictedWaitTime,
  deficit,
  requiredVolunteers,
  headerExtra,
  rightHeader,
  footerExtra,
  volunteers,
  pendingCount = 0,
  acceptedCount = 0,
  enrouteCount = 0,
  arrivedCount = 0,
  inTransitCount = 0,
  effectiveStaff,
  remainingDeficit = 0,
  dispatchStatus,
}) => {
  // Dynamic styling based on predicted risk level
  let valueColorClass = 'text-emerald-700 dark:text-emerald-400';
  let cardClass = 'bg-emerald-50/70 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/30';
  let dotColorClass = 'text-emerald-500';
  let separatorClass = 'border-emerald-100 dark:border-emerald-900/20';

  if (predictedRisk === 'Warning') {
    valueColorClass = 'text-amber-700 dark:text-amber-400';
    cardClass = 'bg-amber-50/70 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30';
    dotColorClass = 'text-amber-500';
    separatorClass = 'border-amber-100 dark:border-amber-900/20';
  } else if (predictedRisk === 'Dangerous') {
    valueColorClass = 'text-red-700 dark:text-red-400';
    cardClass = 'bg-red-50/70 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30';
    dotColorClass = 'text-red-500';
    separatorClass = 'border-red-100 dark:border-red-900/20';
  }

  // All staffing metrics from authoritative backend — NO local recomputation
  const stationedCount = volunteers ? volunteers.length : 0;
  const effectiveTotal = effectiveStaff ?? (stationedCount + inTransitCount);
  const isSatisfied = remainingDeficit <= 0;
  const pct = requiredVolunteers > 0
    ? Math.min((effectiveTotal / requiredVolunteers) * 100, 100)
    : 100;

  // Recommendation purely from backend dispatch_status state machine
  const recommendedAction = getGateActionText(dispatchStatus, remainingDeficit);
  const showAction = recommendedAction !== 'Maintain Current Staffing';

  // Dynamic styles for the Recommended Action card
  let actionBg = '#FFF7E6';
  let actionBorder = '1px solid #FDBA74';
  let actionLabelColor = '#9A3412';
  let actionTextColor = '#C2410C';

  if (recommendedAction === 'Staffing Updated') {
    actionBg = '#ECFDF5';
    actionBorder = '1px solid #A7F3D0';
    actionLabelColor = '#065F46';
    actionTextColor = '#047857';
  } else if (
    recommendedAction === 'Dispatching...' ||
    recommendedAction === 'Volunteers Accepted' ||
    recommendedAction === 'Volunteers En Route'
  ) {
    actionBg = '#EFF6FF';
    actionBorder = '1px solid #BFDBFE';
    actionLabelColor = '#1E40AF';
    actionTextColor = '#1D4ED8';
  }

  return (
    <div 
      className={`p-4.5 shadow-sm flex flex-col justify-between w-full ${showAction ? 'min-h-[285px]' : 'min-h-[240px]'} h-full min-w-0 transition-all duration-300 hover:shadow-md rounded-[20px] ${cardClass}`}
    >
      {/* Top Section: Gate Title & Header Extra */}
      <div className="flex flex-col gap-2.5 mb-4.5">
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          <h3 className="font-outfit text-xs sm:text-sm font-bold leading-tight text-app-text flex items-center min-w-0 flex-1">
            <span className={`${dotColorClass} mr-1.5 text-[10px] select-none`}>●</span>
            <span className="truncate mr-2" title={gateName}>{gateName}</span>
          </h3>
          {rightHeader && <div className="flex-shrink-0 flex items-center">{rightHeader}</div>}
        </div>
        {headerExtra && <div className="w-full">{headerExtra}</div>}
      </div>

      {/* Unified Metrics Grid (3x2) */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">AI Risk Level</span>
          <span className={`font-outfit text-xs font-bold block mt-1 ${valueColorClass} truncate`}>{predictedRisk || 'Waiting for Simulation'}</span>
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">Crowd Congestion</span>
          <span className={`font-outfit text-xs font-bold block mt-1 ${valueColorClass} truncate`}>{congestionLevel || '—'}</span>
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">Occupancy</span>
          <span className={`font-outfit text-xs font-bold block mt-1 ${valueColorClass} truncate`}>{occupancyPercentage}%</span>
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">Queue Length</span>
          <span className={`font-outfit text-xs font-bold block mt-1 ${valueColorClass} truncate`}>{queueLength} Attendees</span>
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">Predicted Wait</span>
          <span className={`font-outfit text-xs font-bold block mt-1 ${valueColorClass} truncate`}>
            {predictedWaitTime != null ? `${predictedWaitTime} min` : 'Waiting for Simulation'}
          </span>
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">Required Staff</span>
          <span className={`font-outfit text-xs font-bold block mt-1 ${valueColorClass} truncate`}>
            {requiredVolunteers != null && requiredVolunteers > 0 ? `${requiredVolunteers} Vols` : 'Waiting for Simulation'}
          </span>
        </div>
      </div>

      {/* Staffing Progress — uses authoritative effectiveTotal */}
      <div className="mb-4 p-2.5 rounded-xl bg-slate-950/40 border border-slate-900/40 space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <span>Staffing Progress</span>
          <span className="font-mono">{effectiveTotal} / {Math.max(requiredVolunteers, effectiveTotal)} ({Math.round(pct)}%)</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${isSatisfied ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Authoritative per-status counts */}
        <div className="flex justify-between items-center text-[9px] font-semibold text-slate-400">
          <div className="flex gap-2 flex-wrap">
            <span>Stationed: <strong className="text-slate-200">{stationedCount}</strong></span>
            {pendingCount > 0 && <><span>•</span><span>Pending: <strong className="text-yellow-400">{pendingCount}</strong></span></>}
            {acceptedCount > 0 && <><span>•</span><span>Accepted: <strong className="text-blue-400">{acceptedCount}</strong></span></>}
            {enrouteCount > 0 && <><span>•</span><span>En Route: <strong className="text-primary">{enrouteCount}</strong></span></>}
            {arrivedCount > 0 && <><span>•</span><span>Arrived: <strong className="text-emerald-400">{arrivedCount}</strong></span></>}
          </div>
          {isSatisfied ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">✓ Staffing Satisfied</span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/25">Deficit: -{remainingDeficit} Vols</span>
          )}
        </div>
      </div>

      {/* Recommended Action */}
      {showAction && (
        <div 
          className="p-2.5 rounded-[10px] flex flex-col justify-center min-h-[52px] shadow-sm"
          style={{ backgroundColor: actionBg, border: actionBorder }}
        >
          <span 
            className="uppercase text-[8px] font-bold tracking-wider leading-tight mb-0.5"
            style={{ color: actionLabelColor }}
          >
            Recommended Action
          </span>
          <span 
            className="text-[11px] font-bold leading-tight"
            style={{ color: actionTextColor }}
          >
            {recommendedAction}
          </span>
        </div>
      )}

      {/* Stationed Volunteers List */}
      {volunteers && volunteers.length > 0 && (
        <div className={`mt-3 pt-3 border-t ${separatorClass}`}>
          <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
            Stationed Volunteers ({volunteers.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {volunteers.map(v => (
              <span key={v.volunteer_id} className="text-[9px] px-2.5 py-0.5 rounded-md bg-slate-950/40 text-slate-350 dark:text-slate-300 border border-slate-850 font-bold" title={v.contact}>
                {v.volunteer_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {footerExtra && (
        <div className={`mt-3 pt-3 border-t ${separatorClass}`}>
          {footerExtra}
        </div>
      )}
    </div>
  );
};
