import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, DoorOpen, ShieldAlert, Users,
  BarChart3, Bell, Settings, LogOut, Shield, CheckSquare,
  Clock, Megaphone, AlertTriangle, Sun, Moon, User, FileText,
  Cpu, Activity, Upload
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../services/api';

interface SidebarProps { isOpen: boolean; setIsOpen: (v: boolean) => void; }

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isLiveMode, setIsLiveMode] = useState(false);

  useEffect(() => {
    // Poll system mode every 10 seconds to keep the sidebar item in sync
    const checkMode = () => {
      api.get('/system/mode')
        .then(res => setIsLiveMode(res.data.system_mode === 'Live'))
        .catch(() => {});
    };
    checkMode();
    const interval = setInterval(checkMode, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Admin menu — exact original page names and correct paths ───────────────
  const adminMenuItems = [
    { name: 'Dashboard',         path: '/dashboard',              icon: LayoutDashboard },
    { name: 'Gates',             path: '/gates',                  icon: DoorOpen },
    { name: 'Risk Monitoring',   path: '/risk',                   icon: Activity },
    { name: 'Volunteers',        path: '/volunteers',             icon: Users },
    { name: 'Analytics',         path: '/analytics',              icon: BarChart3 },
    { name: 'Alert Center',      path: '/alerts',                 icon: ShieldAlert },
    { name: 'Field Incidents',   path: '/incidents',              icon: AlertTriangle },
    { name: 'Reports & Logs',    path: '/reports',                icon: FileText },
    { name: 'Auto Assignment',   path: '/volunteer-assignments',  icon: Cpu },
    { name: 'Settings',          path: '/settings',               icon: Settings },
  ];

  // Live Mode only item — shown when system_mode == 'Live'
  const liveMenuItem = { name: 'Live Import', path: '/live-import', icon: Upload, isLive: true };

  // ── Volunteer portal menu ─────────────────────────────────────────────────
  const volunteerMenuItems = [
    { name: 'Duty Dashboard',   path: '/volunteer/dashboard',     icon: Shield },
    { name: 'Tasks Checklist',  path: '/volunteer/checklist',     icon: CheckSquare },
    { name: 'Shift Attendance', path: '/volunteer/attendance',    icon: Clock },
    { name: 'Bulletins',        path: '/volunteer/announcements', icon: Megaphone },
    { name: 'Field Incidents',  path: '/volunteer/incidents',     icon: AlertTriangle },
    { name: 'Officer Profile',  path: '/volunteer/profile',       icon: User },
    { name: 'Daily Report',     path: '/volunteer/report',        icon: FileText },
  ];

  const menuItems = user?.role === 'volunteer' ? volunteerMenuItems : adminMenuItems;
  const allAdminItems = user?.role === 'volunteer' ? volunteerMenuItems : [
    ...adminMenuItems,
    ...(isLiveMode ? [liveMenuItem] : []),
  ];
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64
        bg-app-sidebar border-r border-app-card-border
        transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Gradient top accent */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-app-card-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-premium flex items-center justify-center shadow-md flex-shrink-0">
            <img src="/src/assets/logo.svg" alt="CrowdShield Logo" className="w-5 h-5 brightness-[3]" />
          </div>
          <div>
            <h1 className="font-outfit text-base font-extrabold text-app-text tracking-tight flex items-center gap-1.5">
              CrowdShield
              <span className="text-primary text-[9px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 font-black">AI</span>
            </h1>
            <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Predict. Prevent. Protect</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest px-3 mb-3">
            {user?.role === 'volunteer' ? 'Duty Portal' : 'Command Center'}
          </p>

          {allAdminItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 group overflow-hidden
                ${isActive
                  ? 'bg-gradient-premium text-white shadow-lg shadow-primary/20'
                  : 'text-slate-500 hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-800/50'}`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Glow on active */}
                  {isActive && (
                    <div className="absolute inset-0 bg-white/5" />
                  )}
                  <div className={`relative z-10 p-1.5 rounded-lg transition-all duration-200
                    ${isActive ? 'bg-white/15' : 'bg-transparent group-hover:bg-slate-800 dark:group-hover:bg-slate-700/50'}`}>
                    <item.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="relative z-10 uppercase tracking-wider">{item.name}</span>
                  {isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                  {'isLive' in item && item.isLive && !isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer: User card + theme + logout */}
        <div className="p-3 border-t border-app-card-border">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-app-card-border mb-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-premium flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-app-text truncate">{user?.full_name || 'Guest User'}</p>
              <p className="text-[10px] text-slate-500 font-semibold capitalize truncate">{user?.role || 'Visitor'}</p>
            </div>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-500 hover:text-app-text hover:bg-slate-800 dark:hover:bg-slate-800 transition-all flex-shrink-0 cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-bold text-rose-500 border border-rose-500/15 bg-rose-500/5 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Account
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;