import React, { useState, useEffect } from 'react';
import { 
  DoorOpen, 
  Users, 
  Clock, 
  UserCheck, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { Gate } from '../types';
import { getRiskColor, getRiskBadge, getRecommendationBadge, getGateActionText } from '../utils/ux';
import { useLiveData } from '../hooks/useLiveData';

export const Gates: React.FC = () => {
  const { gatesMetrics: liveGatesMetrics } = useLiveData();
  const [stateGates, setGates] = useState<Gate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gates = liveGatesMetrics.length > 0 ? liveGatesMetrics : stateGates;

  const fetchGates = async () => {
    try {
      const response = await api.get('/gates/metrics');
      setGates(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to poll foyer status feeds. Verify API Server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGates();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crowdshield_sync_trigger') {
        fetchGates();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-success/10 text-success border-success/20';
      case 'Busy':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'Warning':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Critical':
      case 'Overloaded':
        return 'bg-danger/10 text-danger border-danger/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getRiskStyle = (risk: string) => {
    switch (risk) {
      case 'Safe':
        return 'text-success font-extrabold';
      case 'Warning':
        return 'text-warning font-extrabold';
      case 'High':
        return 'text-orange-500 font-extrabold';
      case 'Critical':
      case 'Dangerous':
        return 'text-danger font-extrabold';
      default:
        return 'text-slate-400 font-bold';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Gate Control Stations</h2>
          <p className="text-sm text-slate-400">Physical foyer entryways capacity limits, live densities, and scanner statuses.</p>
        </div>
        <button 
          onClick={fetchGates}
          className="p-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Status</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid displays */}
      {isLoading && gates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500">Checking entryway sensors...</p>
        </div>
      ) : gates.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-850 rounded-xl bg-slate-900/10 font-semibold text-slate-500">
          No Data Available
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gates.map((g) => {
            const utilizationPct = g.occupancy_percentage;
            const riskCfg = getRiskColor(g.predicted_risk);
            return (
              <div 
                key={g.gate_id} 
                className={`p-6 rounded-2xl border transition-all flex flex-col relative overflow-hidden backdrop-blur-md hover:-translate-y-1 hover:shadow-lg ${riskCfg.border} ${riskCfg.bg} ${riskCfg.cardGlow}`}
              >
                {/* Visual indicator bar at the top */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${riskCfg.bar}`} />

                 <div className="flex flex-col gap-2 mb-4 mt-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-outfit text-lg font-bold text-slate-100 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${riskCfg.dot}`} />
                      <span>{g.gate_name}</span>
                    </h3>
                  </div>
                </div>

                {/* Occupancy % (utilization progress bar) */}
                <div className="space-y-1.5 mb-5 pt-3 border-t border-slate-850">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Occupancy %</span>
                    <span className="text-slate-350">{utilizationPct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
                    <div 
                      className="h-full rounded-full bg-secondary transition-all duration-500"
                      style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Predictions & Staffing Deck */}
                <div className="mt-auto pt-4 border-t border-slate-850 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> AI Risk Level:
                    </span>
                    <span className={`font-semibold ${riskCfg.text}`}>
                      {g.predicted_risk}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> Crowd Congestion:
                    </span>
                    <span className={`font-semibold ${
                      g.congestion_level === 'High' ? 'text-orange-500' : g.congestion_level === 'Medium' ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {g.congestion_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Predicted Wait Time:
                    </span>
                    <span className="font-mono font-bold text-slate-100 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      {g.predicted_wait_time} mins
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Recommended Volunteers:
                    </span>
                    <span className="font-semibold text-slate-300">
                      {g.required_volunteers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Current Volunteers:
                    </span>
                    <span className="font-semibold text-slate-300">
                      {g.stationed_volunteers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2.5">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Volunteer Deficit:
                    </span>
                    <span className={`font-extrabold ${g.deficit > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {g.deficit}
                    </span>
                  </div>
                  
                  {getGateActionText(g.predicted_risk, g.deficit) !== 'Maintain Current Staffing' && (
                    <div 
                      style={{
                        backgroundColor: '#FFF7E6',
                        border: '1px solid #FDBA74',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        minHeight: '52px',
                        marginTop: '12px'
                      }}
                    >
                      <span 
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '8px',
                          fontWeight: 700,
                          color: '#9A3412',
                          letterSpacing: '0.05em',
                          lineHeight: 1.1,
                          marginBottom: '2px'
                        }}
                      >
                        Recommended Action
                      </span>
                      <span 
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#C2410C',
                          lineHeight: 1.2
                        }}
                      >
                        {getGateActionText(g.predicted_risk, g.deficit)}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default Gates;