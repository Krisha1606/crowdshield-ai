import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  UserCheck, 
  UserX, 
  AlertCircle, 
  CheckCircle,
  Calendar,
  Timer,
  Play,
  Square
} from 'lucide-react';
import api from '../services/api';
import { AttendanceStatus } from '../types';

export const VolunteerAttendance: React.FC = () => {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('10:00:00');
  const [currentTime, setCurrentTime] = useState<string>('');

  const fetchAttendanceStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/attendance/status');
      setStatus(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load attendance logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceStatus();
    
    // Digital clock interval
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Countdown calculations
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const endShift = new Date();
      endShift.setHours(19, 0, 0, 0); // 19:00 is shift end

      if (now >= endShift) {
        setTimeRemaining('00:00:00');
        return;
      }

      const diffMs = endShift.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      const pad = (num: number) => String(num).padStart(2, '0');
      setTimeRemaining(`${pad(hours)}:${pad(mins)}:${pad(secs)}`);
    };

    updateCountdown();
    const timerInterval = setInterval(updateCountdown, 1000);
    return () => clearInterval(timerInterval);
  }, [status]);

  const handleCheckIn = async () => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      const response = await api.post('/attendance/check-in');
      setSuccess(response.data.message);
      await fetchAttendanceStatus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Check-in failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    const isConfirmed = window.confirm('Are you sure you want to check out and end your shift?');
    if (!isConfirmed) return;

    setError(null);
    setSuccess(null);
    setActionLoading(true);
    try {
      const response = await api.post('/attendance/check-out');
      setSuccess(response.data.message);
      await fetchAttendanceStatus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Check-out failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium font-outfit">Loading attendance status...</p>
      </div>
    );
  }

  const isCheckedIn = !!status?.is_checked_in;
  const isCompleted = !!(status?.check_in_time && status?.check_out_time);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Shift Log & Attendance</h2>
        <p className="text-sm text-slate-400">Record check-in at shift start and check-out at shift end. Follow assigned rosters.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main layout grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Log Controls */}
        <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Roster Operations</span>
            
            <div className="flex justify-between items-center py-2.5 border-b border-slate-800/40">
              <span className="text-slate-400 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" /> Date
              </span>
              <span className="text-slate-100 text-sm font-semibold">{status?.date || new Date().toISOString().split('T')[0]}</span>
            </div>
            
            <div className="flex justify-between items-center py-2.5 border-b border-slate-800/40">
              <span className="text-slate-400 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> Scheduled shift
              </span>
              <span className="text-slate-100 text-sm font-semibold">09:00 - 19:00</span>
            </div>
            
            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-400 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-500" /> Current status
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isCheckedIn 
                  ? 'bg-success/15 border border-success/30 text-success' 
                  : isCompleted 
                  ? 'bg-primary/15 border border-primary/30 text-primary' 
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}>
                {isCheckedIn ? 'Checked In' : isCompleted ? 'Completed' : 'Off Duty'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button
              onClick={handleCheckIn}
              disabled={isCheckedIn || isCompleted || actionLoading}
              className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-success hover:bg-green-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-lg border border-success/40 transition-all focus:outline-none"
            >
              <Play className="w-4.5 h-4.5 fill-current" />
              <span>Check In</span>
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!isCheckedIn || isCompleted || actionLoading}
              className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-danger hover:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-lg border border-danger/40 transition-all focus:outline-none"
            >
              <Square className="w-4.5 h-4.5 fill-current" />
              <span>Check Out</span>
            </button>
          </div>
        </div>

        {/* Right Column: Clock & Remaining Timer */}
        <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800 flex flex-col items-center justify-center text-center space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">Current local time</span>
            <div className="text-3xl font-extrabold text-white tracking-wider font-mono bg-slate-950/60 px-5 py-2.5 rounded-xl border border-slate-800/80">
              {currentTime || '--:--:--'}
            </div>
          </div>

          <div className="w-full border-t border-slate-800/60 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Shift time remaining</span>
            {isCheckedIn ? (
              <div className="flex flex-col items-center">
                <div className="text-4xl font-black text-primary tracking-widest font-mono mb-2 animate-pulse-slow">
                  {timeRemaining}
                </div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase flex items-center gap-1.5 justify-center">
                  <Timer className="w-4 h-4 text-primary" /> Shift ends at 19:00:00
                </p>
              </div>
            ) : (
              <div className="py-2.5 text-slate-500 font-semibold text-sm">
                Timer inactive. Check in to begin countdown tracking.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Daily Stamp History logs */}
      <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-4">Daily Attendance Records</span>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="pb-3 font-semibold">Shift Date</th>
                <th className="pb-3 font-semibold">Check In Timestamp</th>
                <th className="pb-3 font-semibold">Check Out Timestamp</th>
                <th className="pb-3 font-semibold">Roster Shift</th>
              </tr>
            </thead>
            <tbody>
              {status?.check_in_time ? (
                <tr className="text-slate-300 font-medium border-b border-slate-800/40">
                  <td className="py-4 font-semibold">{status.date}</td>
                  <td className="py-4 font-mono text-xs text-slate-100">{status.check_in_time}</td>
                  <td className="py-4 font-mono text-xs text-slate-100">{status.check_out_time || 'On Duty / Running'}</td>
                  <td className="py-4">09:00 - 19:00</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-slate-500 font-semibold">
                    No active shift records for today. Click Check In to open a log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default VolunteerAttendance;