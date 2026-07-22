import React, { useState, useEffect } from 'react';
import { 
  User, Phone, Mail, Clock, Award, Shield, CheckSquare, 
  AlertTriangle, Key, Edit3, RefreshCw, X, Camera, Calendar, ShieldCheck
} from 'lucide-react';
import api from '../services/api';

interface ProfileStats {
  checklists_submitted: number;
  incidents_reported: number;
  assignments_completed: number;
  today_hours: number;
  total_hours: number;
  operator_score: number;
}

interface TimelineEvent {
  activity_type: string;
  timestamp: string;
  details: string;
}

interface VolunteerProfileData {
  volunteer_id: number;
  volunteer_name: string;
  email: string;
  phone: string;
  emergency_contact: string;
  joining_date: string;
  experience: string;
  profile_photo: string;
  assigned_gate: number | null;
  gate_name: string;
  status: string;
  attendance_status: string;
  stats: ProfileStats;
  timeline: TimelineEvent[];
}

export const VolunteerProfile: React.FC = () => {
  const [profile, setProfile] = useState<VolunteerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const fetchProfile = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/volunteers/my-profile');
      setProfile(response.data);
      // Initialize edit fields
      setPhone(response.data.phone || '');
      setProfilePhoto(response.data.profile_photo || '');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load profile details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (password && password !== confirmPassword) {
      setModalError('Passwords do not match.');
      return;
    }

    setModalSaving(true);
    try {
      await api.put('/volunteers/my-profile', {
        phone: phone.trim(),
        profile_photo: profilePhoto.trim(),
        password: password ? password : null
      });
      setSuccess('Profile updated successfully.');
      setIsModalOpen(false);
      setPassword('');
      setConfirmPassword('');
      await fetchProfile(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setModalSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium font-outfit">Loading profile details...</p>
      </div>
    );
  }

  const initials = profile?.volunteer_name ? profile.volunteer_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'V';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Officer Profile</h2>
          <p className="text-sm text-slate-400">View performance stats, shifts timeline, and edit profile credentials.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-app-card border border-app-card-border hover:border-primary/30 hover:text-primary text-app-text-muted text-xs font-bold rounded-xl transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/25 text-success text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Personal Card */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 flex flex-col items-center text-center relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-premium opacity-10" />

            {/* Avatar / Profile photo */}
            <div className="relative z-10 w-24 h-24 rounded-full border-4 border-app-card-border overflow-hidden bg-slate-800 flex items-center justify-center shadow-lg mb-4 mt-6">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt="Profile Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-primary font-outfit">{initials}</span>
              )}
            </div>

            <h3 className="font-outfit text-lg font-black text-app-text tracking-tight">{profile?.volunteer_name}</h3>
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary rounded-full mt-1.5">
              {profile?.experience || 'Security Officer'}
            </span>

            <div className="w-full mt-6 space-y-3.5 text-left border-t border-app-card-border/60 pt-6">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email Address</p>
                  <p className="text-xs font-semibold text-app-text truncate">{profile?.email || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contact Number</p>
                  <p className="text-xs font-semibold text-app-text font-mono">{profile?.phone || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Emergency Contact</p>
                  <p className="text-xs font-semibold text-app-text font-mono">{profile?.emergency_contact || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Joining Date</p>
                  <p className="text-xs font-semibold text-app-text">{profile?.joining_date || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Roster Location</p>
                  <p className="text-xs font-bold text-app-text">{profile?.gate_name || 'Reserve Pool'}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-6 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Credentials
            </button>
          </div>
        </div>

        {/* Right Columns (2): Statistics & Activity */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Stats Ratios Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: <Clock className="w-5 h-5 text-indigo-400" />, label: "Today's Hours", val: `${profile?.stats.today_hours} hrs`, color: 'bg-indigo-500/5 border-indigo-500/15' },
              { icon: <Award className="w-5 h-5 text-emerald-400" />, label: 'Total Hours', val: `${profile?.stats.total_hours} hrs`, color: 'bg-emerald-500/5 border-emerald-500/15' },
              { icon: <CheckSquare className="w-5 h-5 text-amber-400" />, label: 'Checklists', val: profile?.stats.checklists_submitted || 0, color: 'bg-amber-500/5 border-amber-500/15' },
              { icon: <AlertTriangle className="w-5 h-5 text-red-400" />, label: 'Incidents Reported', val: profile?.stats.incidents_reported || 0, color: 'bg-red-500/5 border-red-500/15' },
              { icon: <Shield className="w-5 h-5 text-blue-400" />, label: 'Tasks Completed', val: profile?.stats.assignments_completed || 0, color: 'bg-blue-500/5 border-blue-500/15' },
              { icon: <Award className="w-5 h-5 text-pink-400" />, label: 'Performance Score', val: `${profile?.stats.operator_score}/100`, color: 'bg-pink-500/5 border-pink-500/15' },
            ].map((stat, i) => (
              <div key={i} className={`p-4 rounded-2xl border ${stat.color} flex items-center gap-3 bg-app-card`}>
                <div className="p-2 rounded-xl bg-slate-950/60">{stat.icon}</div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-base font-black text-app-text font-outfit mt-0.5">{stat.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Activity Timeline */}
          <div className="p-6 rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 space-y-4">
            <h4 className="font-outfit text-base font-bold text-app-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Recent Activity Feed
            </h4>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {profile?.timeline && profile.timeline.length > 0 ? (
                profile.timeline.map((event, idx) => (
                  <div key={idx} className="flex gap-4 items-start relative pl-1 pb-4 last:pb-0">
                    {/* Line connector */}
                    {idx < profile.timeline.length - 1 && (
                      <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-slate-800" />
                    )}
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center relative z-10 ${
                      event.activity_type.includes('Check In') ? 'bg-green-500/10 border-green-500/40 text-green-400' :
                      event.activity_type.includes('Check Out') ? 'bg-red-500/10 border-red-500/40 text-red-400' :
                      event.activity_type.includes('Incident') ? 'bg-orange-500/10 border-orange-500/40 text-orange-400' :
                      'bg-slate-850 border-slate-700 text-slate-400'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-app-text">{event.activity_type}</p>
                        <span className="text-[9px] text-slate-500 font-mono font-semibold">{event.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">{event.details}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-500 font-bold border border-dashed border-app-card-border rounded-2xl">
                  No activity logged. Operations feed will populate automatically.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Edit Credentials Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setIsModalOpen(false); setModalError(null); }}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-outfit text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Edit Profile Details
            </h3>

            {modalError && (
              <div className="p-3 mb-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765-43210"
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-xs font-bold text-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Profile Photo URL</label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={profilePhoto}
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-xs font-semibold text-slate-300"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-4">
                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Reset Shift Password (Optional)</p>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-xs font-semibold text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-xs font-semibold text-slate-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={modalSaving}
                className="w-full py-3 mt-6 text-xs font-bold text-white bg-primary hover:bg-blue-600 border border-primary/45 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                {modalSaving ? (
                  <div className="w-4 h-4 border-2 border-t-white border-white/20 rounded-full animate-spin" />
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolunteerProfile;
