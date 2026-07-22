import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  TrendingUp, 
  Activity, 
  HelpCircle, 
  Info,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import api from '../services/api';
import { Gate } from '../types';
import { getRiskColor, getRiskBadge, getRecommendationBadge, getGateActionText } from '../utils/ux';
import { useLiveData } from '../hooks/useLiveData';

interface RiskHistoryPoint {
  hour: string;
  Index: number;
}

export const Risk: React.FC = () => {
  const { gatesMetrics: liveGatesMetrics, refreshAll } = useLiveData();
  const [stateGates, setStateGates] = useState<Gate[]>([]);
  const [historicalData, setHistoricalData] = useState<RiskHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gates = liveGatesMetrics.length > 0 ? liveGatesMetrics : stateGates;

  const fetchRiskMetrics = async () => {
    try {
      const response = await api.get('/gates/metrics');
      if (Array.isArray(response.data)) {
        setStateGates(response.data);
      }
      setError(null);
    } catch (err: any) {
      setError('Unable to parse risk evaluations from backend APIs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskMetrics();
    const handleStorageChange = () => {
      fetchRiskMetrics();
      refreshAll();
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('crowdshield_sync_trigger', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('crowdshield_sync_trigger', handleStorageChange);
    };
  }, [refreshAll]);

  // Calculate totals from real gate metrics
  const totalGates = gates.length;
  const safeCount = gates.filter(g => g.predicted_risk === 'Safe').length;
  const warningCount = gates.filter(g => g.predicted_risk === 'Warning' || g.predicted_risk === 'High').length;
  const dangerousCount = gates.filter(g => g.predicted_risk === 'Dangerous' || g.predicted_risk === 'Critical').length;

  // Build real historical risk trend dynamically from live simulation data
  useEffect(() => {
    if (!gates || gates.length === 0) return;

    // Calculate real risk index for current metrics snapshot
    // Safe = 1.0, Warning/High = 2.0, Dangerous/Critical = 3.0
    const gateScores = gates.map(g => {
      const r = g.predicted_risk;
      if (r === 'Dangerous' || r === 'Critical') return 3.0;
      if (r === 'Warning' || r === 'High') return 2.0;
      return 1.0;
    });

    const avgRisk = Number((gateScores.reduce((a, b) => a + b, 0) / gates.length).toFixed(1));
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Read session history
    let existingHistory: RiskHistoryPoint[] = [];
    try {
      const stored = sessionStorage.getItem('crowdshield_risk_history');
      if (stored) {
        existingHistory = JSON.parse(stored);
      }
    } catch (e) {
      existingHistory = [];
    }

    // Append new real data point if timestamp or risk index updated
    const lastPoint = existingHistory[existingHistory.length - 1];
    if (!lastPoint || lastPoint.Index !== avgRisk || lastPoint.hour !== timeStr) {
      const updatedHistory = [...existingHistory, { hour: timeStr, Index: avgRisk }].slice(-20);
      try {
        sessionStorage.setItem('crowdshield_risk_history', JSON.stringify(updatedHistory));
      } catch (e) {}
      setHistoricalData(updatedHistory);
    } else {
      setHistoricalData(existingHistory);
    }
  }, [gates]);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">AI Risk Monitoring</h2>
          <p className="text-sm text-slate-400">Dynamic safety classifications utilizing our pre-trained Random Forest Classifier.</p>
        </div>
        <button 
          onClick={() => { fetchRiskMetrics(); refreshAll(); }}
          className="p-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Safety Classifications Cards */}
      {gates.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-850 rounded-xl bg-slate-900/10 font-semibold text-slate-500">
          No Data Available
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-success/20 bg-success/5 text-center flex flex-col items-center">
              <span className="w-10 h-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center text-success mb-3">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <h4 className="font-outfit text-sm font-bold text-success uppercase tracking-wider">Safe State</h4>
              <p className="font-outfit text-3xl font-black text-slate-100 mt-2">{safeCount} <span className="text-xs text-slate-500 font-medium">Foyer Gates</span></p>
            </div>

            <div className="p-6 rounded-2xl border border-warning/20 bg-warning/5 text-center flex flex-col items-center">
              <span className="w-10 h-10 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mb-3">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <h4 className="font-outfit text-sm font-bold text-warning uppercase tracking-wider">Warning State</h4>
              <p className="font-outfit text-3xl font-black text-slate-100 mt-2">{warningCount} <span className="text-xs text-slate-500 font-medium">Foyer Gates</span></p>
            </div>

            <div className="p-6 rounded-2xl border border-danger/20 bg-danger/5 text-center flex flex-col items-center">
              <span className="w-10 h-10 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-3">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </span>
              <h4 className="font-outfit text-sm font-bold text-danger uppercase tracking-wider">Dangerous State</h4>
              <p className="font-outfit text-3xl font-black text-slate-100 mt-2">{dangerousCount} <span className="text-xs text-slate-500 font-medium">Foyer Gates</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Heatmap Section */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
              <h3 className="font-outfit font-bold text-slate-100 text-base mb-4">Live Risk Heat Map</h3>
              <p className="text-xs text-slate-500 mb-6">Interactive foyer spatial density checks mapped against capacity loads.</p>
              
              <div className="space-y-4">
                {gates.map((g) => {
                  const riskCfg = getRiskColor(g.predicted_risk);
                  return (
                    <div key={g.gate_id} className={`p-4 rounded-xl border transition-all space-y-3 ${riskCfg.border} ${riskCfg.bg}`}>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-100 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${riskCfg.dot}`} />
                          {g.gate_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-850">
                          <div 
                            className={`h-full rounded-full ${riskCfg.bar}`} 
                            style={{ width: `${Math.min(g.occupancy_percentage, 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-slate-350">{g.occupancy_percentage}%</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-850/60">
                        <span>Current Volunteers: {g.stationed_volunteers}</span>
                        <span>Predicted Wait Time: {g.predicted_wait_time} min</span>
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
                  );
                })}
              </div>
            </div>

            {/* Historical trend graph */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass flex flex-col justify-between">
              <div>
                <h3 className="font-outfit font-bold text-slate-100 text-base mb-2">Historical Risk Trend</h3>
                <p className="text-xs text-slate-500 mb-6">Chronological fluctuations of risk categories tracked over live simulation cycles.</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={11} />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11} 
                      domain={[1, 3]} 
                      ticks={[1, 2, 3]} 
                      tickFormatter={(v) => v === 1 ? 'Safe' : v === 2 ? 'Warning' : 'Danger'}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(v: any) => [v === 1 ? 'Safe' : v === 2 ? 'Warning' : 'Dangerous', 'Risk Index']}
                    />
                    <Line type="monotone" dataKey="Index" stroke="#2563EB" strokeWidth={3} dot={{ stroke: '#3B82F6', strokeWidth: 2, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-2 p-3 bg-slate-950/40 rounded-xl border border-slate-850 text-[10px] text-slate-500 leading-relaxed font-semibold mt-4">
                <Info className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Risk scores scale from 1 (Safe) to 3 (Dangerous) based on peak load overlays. Updated dynamically from live simulation telemetry.</span>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};
export default Risk;