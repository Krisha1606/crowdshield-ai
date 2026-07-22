import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { LiveDataProvider } from './hooks/useLiveData';
import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Events } from './pages/Events';
import { Gates } from './pages/Gates';
import { Risk } from './pages/Risk';
import { Volunteers } from './pages/Volunteers';
import { Analytics } from './pages/Analytics';
import { AlertCenter } from './pages/AlertCenter';
import { Settings } from './pages/Settings';
import { VolunteerDashboard } from './pages/VolunteerDashboard';
import { VolunteerChecklist } from './pages/VolunteerChecklist';
import { VolunteerAttendance } from './pages/VolunteerAttendance';
import { VolunteerAnnouncements } from './pages/VolunteerAnnouncements';
import { VolunteerIncidents } from './pages/VolunteerIncidents';
import { VolunteerAssignments } from './pages/VolunteerAssignments';
import { VolunteerProfile } from './pages/VolunteerProfile';
import { VolunteerWorkReport } from './pages/VolunteerWorkReport';
import { LiveImport } from './pages/LiveImport';
import { AdminIncidents } from './pages/AdminIncidents';
import { AdminReports } from './pages/AdminReports';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LiveDataProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Views */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
              </Route>

              {/* Protected Command Center Views */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/events" element={<Events />} />
                <Route path="/gates" element={<Gates />} />
                <Route path="/risk" element={<Risk />} />
                <Route path="/volunteers" element={<Volunteers />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/alerts" element={<AlertCenter />} />
                <Route path="/volunteer-assignments" element={<VolunteerAssignments />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/live-import" element={<LiveImport />} />
                <Route path="/incidents" element={<AdminIncidents />} />
                <Route path="/reports" element={<AdminReports />} />

                {/* Volunteer Portal Views */}
                <Route path="/volunteer/dashboard" element={<VolunteerDashboard />} />
                <Route path="/volunteer/checklist" element={<VolunteerChecklist />} />
                <Route path="/volunteer/attendance" element={<VolunteerAttendance />} />
                <Route path="/volunteer/announcements" element={<VolunteerAnnouncements />} />
                <Route path="/volunteer/incidents" element={<VolunteerIncidents />} />
                <Route path="/volunteer/profile" element={<VolunteerProfile />} />
                <Route path="/volunteer/report" element={<VolunteerWorkReport />} />
              </Route>

              {/* Fallback routing redirecting to Landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </LiveDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
