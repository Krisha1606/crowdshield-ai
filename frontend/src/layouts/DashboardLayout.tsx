import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';

export const DashboardLayout: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A]">
        <div className="w-12 h-12 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-400 font-medium font-outfit">Synchronizing CrowdShield AI Command Center...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Enforce role-based access guard: volunteers cannot access admin paths
  if (user?.role === 'volunteer' && !location.pathname.startsWith('/volunteer/')) {
    return <Navigate to="/volunteer/dashboard" replace />;
  }

  // Enforce role-based access guard: admins cannot access volunteer paths
  if (user?.role === 'admin' && location.pathname.startsWith('/volunteer/')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg transition-colors duration-300">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
