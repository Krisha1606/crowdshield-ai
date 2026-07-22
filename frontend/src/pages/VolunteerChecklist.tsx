import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square,
  ShieldCheck, 
  AlertCircle, 
  Save, 
  HelpCircle,
  QrCode,
  Lock,
  Route,
  Activity,
  Layers,
  Sparkles,
  Radio
} from 'lucide-react';
import api from '../services/api';

interface ChecklistState {
  arrived_at_gate: number;
  qr_scanner_working: number;
  barricades_checked: number;
  crowd_flow_normal: number;
  emergency_exit_clear: number;
  communication_device_checked: number;
  shift_completed: number;
}

export const VolunteerChecklist: React.FC = () => {
  const [checklist, setChecklist] = useState<ChecklistState>({
    arrived_at_gate: 0,
    qr_scanner_working: 0,
    barricades_checked: 0,
    crowd_flow_normal: 0,
    emergency_exit_clear: 0,
    communication_device_checked: 0,
    shift_completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/volunteers/checklist');
      if (response.data) {
        setChecklist({
          arrived_at_gate: response.data.arrived_at_gate || 0,
          qr_scanner_working: response.data.qr_scanner_working || 0,
          barricades_checked: response.data.barricades_checked || 0,
          crowd_flow_normal: response.data.crowd_flow_normal || 0,
          emergency_exit_clear: response.data.emergency_exit_clear || 0,
          communication_device_checked: response.data.communication_device_checked || 0,
          shift_completed: response.data.shift_completed || 0
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to fetch checklist records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  const toggleTask = (key: keyof ChecklistState) => {
    setChecklist(prev => ({
      ...prev,
      [key]: prev[key] === 1 ? 0 : 1
    }));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await api.post('/volunteers/checklist', checklist);
      setSuccess('Your daily safety inspection checklists have been successfully recorded.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to save checklist records.');
    } finally {
      setSaving(false);
    }
  };

  // Checklist tasks mapping
  const tasks = [
    {
      id: 'arrived_at_gate' as keyof ChecklistState,
      title: 'Arrived at Gate',
      description: 'Physically present at your designated station and ready for duty.',
      icon: Route
    },
    {
      id: 'qr_scanner_working' as keyof ChecklistState,
      title: 'QR Scanner Working',
      description: 'Check ticket scanner power, Wi-Fi connectivity, and confirm it responds to test scans.',
      icon: QrCode
    },
    {
      id: 'barricades_checked' as keyof ChecklistState,
      title: 'Barricades Checked',
      description: 'Inspect layout positioning of foyer barriers. Align rows to create straight queue pipelines.',
      icon: Layers
    },
    {
      id: 'crowd_flow_normal' as keyof ChecklistState,
      title: 'Crowd Flow Normal',
      description: 'Verify crowd ingress and egress paths show uniform speed and layout without bottlenecks.',
      icon: Activity
    },
    {
      id: 'emergency_exit_clear' as keyof ChecklistState,
      title: 'Emergency Exit Clear',
      description: 'Verify emergency exit doors are completely clear, unlocked, and pathways are unblocked.',
      icon: Lock
    },
    {
      id: 'communication_device_checked' as keyof ChecklistState,
      title: 'Communication Device Checked',
      description: 'Test walkie-talkie signal, battery percentage, and confirm connection with coordinator channel.',
      icon: Radio
    },
    {
      id: 'shift_completed' as keyof ChecklistState,
      title: 'Shift Completed',
      description: 'End-of-duty checklist. Confirm handoff tasks are documented and logged.',
      icon: Sparkles
    }
  ];

  const totalCompleted = Object.values(checklist).reduce((a, b) => a + b, 0);
  const completionPercentage = Math.round((totalCompleted / tasks.length) * 100);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium font-outfit">Loading checklist files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header section */}
      <div>
        <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Daily Safety Checklist</h2>
        <p className="text-sm text-slate-400">Complete inspections daily. Check completed operations to log records in the database.</p>
      </div>

      {/* Progress Card */}
      <div className="p-6 rounded-2xl bg-app-card border border-app-card-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block mb-1">Checklist Progress</span>
            <h3 className="text-xl font-bold text-slate-100 font-outfit">{totalCompleted} of {tasks.length} Duties Completed</h3>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            completionPercentage === 100 
              ? 'bg-success/20 text-success border border-success/30' 
              : 'bg-primary/20 text-primary border border-primary/30'
          }`}>
            {completionPercentage}% Complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold">
          <ShieldCheck className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Checklist Grid */}
      <div className="space-y-3.5">
        {tasks.map((task) => {
          const isDone = checklist[task.id] === 1;
          const TaskIcon = task.icon;

          return (
            <div 
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:scale-[1.01] ${
                isDone 
                  ? 'bg-primary/5 border-primary/45 shadow-sm' 
                  : 'bg-app-card border-app-card-border hover:bg-slate-900/50 hover:border-slate-700/80'
              }`}
            >
              {/* Checkbox button */}
              <button 
                type="button"
                className="mt-0.5 text-primary focus:outline-none"
              >
                {isDone ? (
                  <CheckSquare className="w-6 h-6 animate-scale-up text-primary" />
                ) : (
                  <Square className="w-6 h-6 text-slate-600 hover:text-slate-400" />
                )}
              </button>

              {/* Text content */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <TaskIcon className={`w-4 h-4 ${isDone ? 'text-primary' : 'text-slate-500'}`} />
                  <span className={`font-semibold text-sm ${isDone ? 'text-slate-100' : 'text-slate-350'}`}>{task.title}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{task.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-slate-800/60 pt-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <HelpCircle className="w-4.5 h-4.5" />
          <span>Make sure you physically inspect each item before checking.</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-blue-750 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-lg border border-primary/40 focus:outline-none transition-all cursor-pointer"
        >
          <Save className="w-4.5 h-4.5" />
          <span>{saving ? 'Recording logs...' : 'Save Inspection Logs'}</span>
        </button>
      </div>
    </div>
  );
};
export default VolunteerChecklist;