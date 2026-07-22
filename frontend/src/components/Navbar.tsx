import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Moon, Sun, Menu, Bell, Shield, X, UserCheck, CheckCircle, ArrowRight, Zap, Users, Sparkles } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useLiveData } from '../hooks/useLiveData';
import api from '../services/api';

// ── Types ────────────────────────────────────────────────────────────────────
interface StaffNotif {
  alert_id: number;
  gate_name: string;
  message: string;
  alert_time: string;
  is_resolved: number;
}

// ── Navbar Props ──────────────────────────────────────────────────────────────
interface NavbarProps {
  onMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const { notifs: liveNotifs, attendeeCount: liveAttendeeCount, systemMode: liveSystemMode } = useLiveData();

  const [stateNotifs, setNotifs]           = useState<StaffNotif[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                   = useRef<HTMLDivElement>(null);

  const notifs = liveNotifs.length > 0 ? liveNotifs : stateNotifs;
  const attendeeCount = liveAttendeeCount;
  const systemMode = liveSystemMode;

  // ── Page title ──────────────────────────────────────────────────────────────
  const getTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/volunteer/dashboard'))    return 'Volunteer Dashboard';
    if (path.startsWith('/volunteer/checklist'))    return 'Duty Checklist';
    if (path.startsWith('/volunteer/attendance'))   return 'Shift Attendance';
    if (path.startsWith('/volunteer/announcements'))return 'Operations Bulletins';
    if (path.startsWith('/volunteer/incidents'))    return 'Field Incidents';
    if (path === '/dashboard')         return 'Command Center Dashboard';
    if (path === '/events')            return 'Event Logistics';
    if (path === '/gates')             return 'Smart Gates Control';
    if (path === '/risk')              return 'AI Risk Monitoring';
    if (path === '/volunteers')        return 'Volunteer Directory';
    if (path === '/analytics')         return 'Ingress Analytics';
    if (path === '/alerts')            return 'Alert Center';
    if (path === '/incidents')         return 'Incident Command Center';
    if (path === '/reports')           return 'Reports & Performance Logs';
    if (path === '/settings')          return 'Platform Settings';
    if (path === '/volunteer-assignments') return 'Volunteer Auto-Assignment';
    return 'CrowdShield AI';
  };



  // Shared LiveData handles automatic polling & storage sync for Navbar automatically.



  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifs.filter(n => n.is_resolved === 0).length;

  return (
    <>
      <header className="flex items-center justify-between px-6 h-[72px] bg-app-card border-b border-app-card-border transition-colors duration-300 shrink-0">
        {/* Left */}
        <div className="flex items-center gap-4">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="p-2 -ml-2 text-app-text-muted hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-800 rounded-xl lg:hidden transition-all cursor-pointer"
              title="Toggle Sidebar Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h2 className="font-outfit text-lg font-bold text-app-text tracking-tight capitalize">
            {getTitle()}
          </h2>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* People Count Badge */}
          {attendeeCount !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>{attendeeCount} Checked In</span>
            </div>
          )}

          {/* Live sync badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE SYNC ACTIVE</span>
          </div>

          {/* System Mode Badge */}
          {systemMode === 'Live' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              <span>LIVE MODE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>DEMO MODE</span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 text-app-text-muted hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-800 dark:hover:border-slate-700 cursor-pointer"
            title="Toggle Color Mode"
          >
            {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
          </button>

          {/* ── Bell notification button + dropdown ── */}
          {user?.role === 'admin' ? (
            <div className="relative" ref={dropdownRef}>
              <button
                id="navbar-bell-btn"
                onClick={() => setDropdownOpen(o => !o)}
                className="p-2.5 text-app-text-muted hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-800 dark:hover:border-slate-700 relative cursor-pointer"
                title="Redeployment Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center animate-pulse leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown panel */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Redeployment Feed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[9px] font-black border border-rose-500/30">
                          {unreadCount} LIVE
                        </span>
                      )}
                      <button onClick={() => setDropdownOpen(false)}>
                        <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                      </button>
                    </div>
                  </div>

                  {/* Notification list */}
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
                    {notifs.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs font-semibold">
                        No redeployment notifications yet.<br />Run Auto Assignment to start.
                      </div>
                    ) : (
                      notifs.map(n => {
                        const isAI       = n.message.includes('AI assigned');
                        const isAccept   = n.message.includes('accepted');
                        const isEnRoute  = n.message.includes('en route');
                        const isArrived  = n.message.includes('arrived');
                        const dotColor   = isAI      ? 'bg-amber-400'
                                         : isAccept  ? 'bg-green-400'
                                         : isEnRoute ? 'bg-blue-400'
                                         : isArrived ? 'bg-emerald-400'
                                         : 'bg-slate-500';
                        const timeStr = n.alert_time
                          ? n.alert_time.split(' ')[1]?.slice(0, 5) ?? n.alert_time
                          : '';
                        return (
                          <div
                            key={n.alert_id}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors ${n.is_resolved === 0 ? 'bg-slate-800/20' : ''}`}
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor} ${n.is_resolved === 0 ? 'animate-pulse' : 'opacity-40'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold leading-snug ${n.is_resolved === 0 ? 'text-slate-100' : 'text-slate-400'}`}>
                                {n.message}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-500 font-mono">{timeStr}</span>
                                <span className="text-[9px] text-slate-600">·</span>
                                <span className="text-[10px] text-slate-500 truncate">{n.gate_name}</span>
                              </div>
                            </div>
                            {n.is_resolved === 0 && (
                              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-2" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600 font-semibold">Polls every 4s</span>
                    <Link
                      to="/alerts"
                      onClick={() => setDropdownOpen(false)}
                      className="text-[10px] font-bold text-primary hover:text-blue-400 transition-colors"
                    >
                      View all in Alert Center →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Volunteer — simple link */
            <Link
              to="/volunteer/announcements"
              className="p-2.5 text-app-text-muted hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-800 dark:hover:border-slate-700 relative"
              title="Notifications & Bulletins"
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            </Link>
          )}

          {/* User avatar */}
          <div className="flex items-center gap-3 pl-2 border-l border-app-card-border">
            <div className="w-8.5 h-8.5 rounded-full bg-gradient-premium text-white flex items-center justify-center font-bold text-xs shrink-0 select-none">
              {user?.full_name ? user.full_name.split(' ').map((n: string) => n[0]).join('') : 'U'}
            </div>
          </div>
        </div>
      </header>


    </>
  );
};

export default Navbar;
