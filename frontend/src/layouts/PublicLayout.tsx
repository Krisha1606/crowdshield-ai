import React from 'react';
import { Outlet } from 'react-router-dom';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col">
      <Outlet />
    </div>
  );
};
export default PublicLayout;
