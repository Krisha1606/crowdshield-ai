import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldAlert, 
  ShieldCheck, 
  HelpCircle, 
  MapPin, 
  Trash2, 
  UserCheck, 
  CheckCircle,
  X,
  AlertTriangle,
  Lightbulb,
  PhoneCall,
  Activity,
  Clock,
  Mail,
  Lock,
  FileSpreadsheet,
  Zap
} from 'lucide-react';
import api from '../services/api';
import { Volunteer, Gate } from '../types';
import { getRiskColor, getRiskBadge, getRecommendationBadge, getGateActionText } from '../utils/ux';

export const Volunteers: React.FC = () => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [gatesMetrics, setGatesMetrics] = useState<Gate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [assignedGateId, setAssignedGateId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experience, setExperience] = useState('Entry Level');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('');

  // Detailed view modal state
  const [selectedVolId, setSelectedVolId] = useState<number | null>(null);
  const [volDetails, setVolDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<'timeline' | 'attendance' | 'checklists' | 'reports' | 'notifications' | 'incidents' | 'assignments'>('timeline');

  // Monitoring dashboard state
  const [monitorTab, setMonitorTab] = useState('roster');
  const [dailyReports, setDailyReports] = useState<any[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingReports, setLoadingReports] = useState(false);
  const [monitoringData, setMonitoringData] = useState<{
    kpis: { total: number; active: number; offline: number; break: number; busy: number; available: number };
    roster: any[];
    activity_logs: any[];
    assignment_requests: any[];
  } | null>(null);

  const fetchRoster = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [volRes, gatesRes, monitorRes] = await Promise.all([
        api.get('/volunteers'),
        api.get('/gates/metrics'),
        api.get('/admin/volunteer-monitoring')
      ]);
      setVolunteers(volRes.data);
      setGatesMetrics(gatesRes.data);
      setMonitoringData(monitorRes.data);
    } catch (err: any) {
      setError('Failed to fetch volunteer rosters. Verify API Server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'crowdshield_sync_trigger') {
        fetchRoster();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(fetchRoster, 5000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleRegisterVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim() || !contact.trim() || !username.trim() || !password) {
      setError('Name, emergency contact, username, and password are required.');
      return;
    }

    try {
      await api.post('/volunteers', {
        volunteer_name: name.trim(),
        contact: contact.trim(),
        assigned_gate: assignedGateId ? Number(assignedGateId) : null,
        username: username.trim(),
        password: password,
        email: email.trim() || null,
        phone: phone.trim() || null,
        experience: experience,
        joining_date: joiningDate,
        profile_photo: profilePhoto.trim() || null,
        age: age !== '' ? Number(age) : null,
        gender: gender || null
      });

      setSuccessMsg(`Volunteer "${name}" successfully registered and deployed.`);
      setIsModalOpen(false);
      setName('');
      setContact('');
      setAssignedGateId(null);
      setUsername('');
      setPassword('');
      setEmail('');
      setPhone('');
      setExperience('Entry Level');
      setJoiningDate(new Date().toISOString().split('T')[0]);
      setProfilePhoto('');
      setAge('');
      setGender('');
      fetchRoster();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register volunteer.');
    }
  };

  const fetchVolunteerDetails = async (id: number) => {
    setSelectedVolId(id);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailsTab('timeline');
    try {
      const response = await api.get(`/admin/volunteers/${id}`);
      setVolDetails(response.data);
    } catch (err: any) {
      setDetailsError(err.response?.data?.detail || 'Failed to fetch volunteer details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSendReminder = async (type: string) => {
    if (!selectedVolId) return;
    try {
      await api.post(`/admin/volunteers/${selectedVolId}/remind`, { reminder_type: type });
      alert(`${type} reminder sent successfully!`);
    } catch (err) {
      alert('Failed to send reminder.');
    }
  };

  const fetchDailyReports = async () => {
    try {
      setLoadingReports(true);
      const response = await api.get(`/admin/daily-reports?search=${encodeURIComponent(reportSearch)}`);
      setDailyReports(response.data);
    } catch (err) {
      console.error("Failed to fetch daily reports", err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (monitorTab === 'reports') {
      fetchDailyReports();
    }
  }, [monitorTab, reportSearch]);

  const handleReassignVolunteer = async (volunteer: Volunteer, gateId: number | null) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await api.put(`/volunteers/${volunteer.volunteer_id}`, {
        volunteer_name: volunteer.volunteer_name,
        contact: volunteer.contact,
        assigned_gate: gateId ? Number(gateId) : null
      });

      setSuccessMsg(`Volunteer "${volunteer.volunteer_name}" roster assignment updated.`);
      fetchRoster();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError('Roster reassignment failed.');
    }
  };

  const handleStatusChange = async (volunteerId: number, name: string, contact: string, assignedGate: number | null, newStatus: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await api.put(`/volunteers/${volunteerId}`, {
        volunteer_name: name,
        contact: contact,
        assigned_gate: assignedGate,
        status: newStatus
      });

      setSuccessMsg(`Volunteer "${name}" status updated to "${newStatus}".`);
      fetchRoster();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Status update failed.');
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleDeleteVolunteer = async (id: number, volunteerName: string) => {
    const isConfirmed = window.confirm(`Remove "${volunteerName}" from active rosters?`);
    if (!isConfirmed) return;

    setError(null);
    setSuccessMsg(null);
    try {
      await api.delete(`/volunteers/${id}`);
      setSuccessMsg(`Volunteer "${volunteerName}" removed from system.`);
      fetchRoster();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError('Failed to remove volunteer.');
    }
  };

  // Roster summaries
  const totalVolunteersCount = volunteers.length;
  const stationedCount = volunteers.filter(v => v.assigned_gate !== null).length;
  const reserveCount = volunteers.filter(v => v.assigned_gate === null).length;

  const filteredVolunteers = volunteers.filter(v => {
    const search = searchTerm.toLowerCase();
    const nameMatch = v.volunteer_name.toLowerCase().includes(search);
    const contactMatch = v.contact.toLowerCase().includes(search);
    const statusMatch = (v.status || '').toLowerCase().includes(search);
    
    const gate = gatesMetrics.find(g => g.gate_id === v.assigned_gate);
    const gateMatch = gate ? gate.gate_name.toLowerCase().includes(search) : false;
    const isUnassignedMatch = !v.assigned_gate && 'unassigned'.includes(search);
    
    return nameMatch || contactMatch || statusMatch || gateMatch || isUnassignedMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Roster &amp; Personnel</h2>
          <p className="text-sm text-slate-400">Roster registries, deployment suggesting systems, and ML-deficit indicators.</p>
        </div>
        <button
          onClick={() => {
            setName('');
            setContact('');
            setAssignedGateId(null);
            setUsername('');
            setPassword('');
            setEmail('');
            setPhone('');
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-lg shadow-md shadow-primary/20 hover:shadow-primary/35 border border-primary/45 font-semibold text-sm transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Staff</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI summaries */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-850 bg-slate-900">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Registered</span>
          <span className="font-outfit text-2xl font-extrabold text-slate-100">{totalVolunteersCount} <span className="text-xs text-slate-500 font-medium">Volunteers</span></span>
        </div>
        <div className="p-4 rounded-xl border border-slate-850 bg-slate-900">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Active Stationed Staff</span>
          <span className="font-outfit text-2xl font-extrabold text-slate-100">{stationedCount} <span className="text-xs text-slate-500 font-medium">on Entrance Foyers</span></span>
        </div>
        <div className="p-4 rounded-xl border border-slate-850 bg-slate-900">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reserves Available</span>
          <span className="font-outfit text-2xl font-extrabold text-slate-100">{reserveCount} <span className="text-xs text-slate-500 font-medium">awaiting dispatch</span></span>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Checklist Compliance</span>
          <span className="font-outfit text-2xl font-extrabold text-emerald-400">
            {monitoringData ? monitoringData.kpis.active : 0} <span className="text-xs text-emerald-600 font-medium">checked in today</span>
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">of {totalVolunteersCount} total staff</span>
        </div>
      </div>


      {/* Grid: Left ( Roster List & Deficit Tables ), Right ( Recommendations Feed ) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Section: Table grids */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Stationed Deficit Table */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
            <h3 className="font-outfit font-bold text-slate-100 text-base mb-4">Entrance Staffing &amp; ML Deficit Analysis</h3>
            
            {gatesMetrics.length === 0 ? (
              <p className="text-xs text-slate-500 text-center font-medium py-8">No Data Available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-800">
                    <tr>
                      <th className="pb-3">Gate Name</th>
                      <th className="pb-3 text-center">Current Volunteers</th>
                      <th className="pb-3 text-center">Recommended Volunteers</th>
                      <th className="pb-3 text-center">Volunteer Deficit</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {gatesMetrics.map((g) => {
                      const riskCfg = getRiskColor(g.predicted_risk);
                      return (
                        <tr key={g.gate_id} className="hover:bg-slate-950/20">
                          <td className="py-3.5 font-bold text-slate-100 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${riskCfg.dot}`} />
                            {g.gate_name}
                          </td>
                          <td className="py-3.5 text-center font-semibold text-slate-300">{g.stationed_volunteers}</td>
                          <td className="py-3.5 text-center font-semibold text-slate-300">{g.required_volunteers}</td>
                          <td className={`py-3.5 text-center font-mono font-bold ${g.deficit > 0 ? 'text-danger' : 'text-success'}`}>
                            {g.deficit}
                          </td>
                          <td className="py-3.5 text-right font-bold">
                            <span className={getRecommendationBadge(g.deficit)}>
                              {getGateActionText(g.predicted_risk, g.deficit)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Volunteer Roster Details */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="font-outfit font-bold text-slate-100 text-base">Stationed Personnel Roster</h3>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search staff by name, contact, gate..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950/80 hover:bg-slate-950 text-slate-350 placeholder-slate-500 rounded border border-slate-800 focus:border-primary focus:outline-none font-medium"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            {filteredVolunteers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center font-medium py-8">
                {volunteers.length === 0 ? "No Data Available" : "No matching staff members found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-800">
                    <tr>
                      <th className="pb-3">Volunteer Name</th>
                      <th className="pb-3">Contact</th>
                      <th className="pb-3">Assigned Gate</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {filteredVolunteers.map((v) => (
                      <tr key={v.volunteer_id} className="hover:bg-slate-950/20">
                        <td className="py-3.5 font-bold text-slate-100 cursor-pointer hover:text-primary transition-colors" onClick={() => fetchVolunteerDetails(v.volunteer_id)}>
                          {v.volunteer_name}
                        </td>
                        <td className="py-3.5 font-mono text-slate-400 flex items-center gap-1.5">
                          <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
                          <span>{v.contact}</span>
                        </td>
                        <td className="py-3.5">
                          <select
                            value={v.assigned_gate || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleReassignVolunteer(v, val ? Number(val) : null);
                            }}
                            className="bg-slate-950/80 hover:bg-slate-950 text-slate-300 text-xs rounded border border-slate-800 focus:outline-none p-1 font-semibold"
                          >
                            <option value="">None (Unassigned)</option>
                            {gatesMetrics.map((g) => (
                              <option key={g.gate_id} value={g.gate_id}>{g.gate_name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteVolunteer(v.volunteer_id, v.volunteer_name)}
                            className="p-1 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 rounded-md transition-colors"
                            title="Remove Personnel"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Column Section: Dispatch Suggestions */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass">
            <h3 className="font-outfit font-bold text-slate-100 text-base mb-4">AI Dispatch Recommendations</h3>
            
            <div className="space-y-4">
              {/* Check if deficit exists */}
              {gatesMetrics.some(g => g.deficit > 0) ? (
                gatesMetrics.filter(g => g.deficit > 0).map((g) => (
                  <div 
                    key={g.gate_id} 
                    className="p-4 rounded-xl border border-danger/20 bg-danger/5 text-xs text-danger space-y-2"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <ShieldAlert className="w-4.5 h-4.5" />
                      <span>Roster Shortage at {g.gate_name}</span>
                    </div>
                    <p className="text-slate-400 font-medium leading-relaxed">
                      Current load predicts a required count of <strong>{g.required_volunteers} volunteers</strong>. Reroute <strong>{g.deficit} available staff</strong> from reserves immediately.
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl border border-success/20 bg-success/5 text-xs text-success flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h5 className="font-bold">Rosters Balanced</h5>
                    <p className="text-slate-400 mt-1 leading-relaxed">All active entryway staff counts meet or exceed the predicted ML safety requirements.</p>
                  </div>
                </div>
              )}

              {/* High Queue recommendation */}
              {gatesMetrics.filter(g => g.queue_length >= 5).map((g) => (
                <div 
                  key={g.gate_id} 
                  className="p-4 rounded-xl border border-warning/20 bg-warning/5 text-xs text-warning space-y-2"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Lightbulb className="w-4.5 h-4.5" />
                    <span>Queue Overflow Alert</span>
                  </div>
                  <p className="text-slate-400 font-medium leading-relaxed">
                    Physical queue length at <strong>{g.gate_name}</strong> has reached {g.queue_length}. Reroute unassigned volunteers to speed check-ins and reduce delays.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-outfit text-lg font-bold text-slate-100 mb-6">Register &amp; Deploy Staff</h3>

            <form onSubmit={handleRegisterVolunteer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Liam Smith"
                  className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. liam_smith"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="liam@example.com"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765-43210"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Emergency Contact Number</label>
                <input
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. +91 98765-43210 (Self/Parent)"
                  className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Experience Level</label>
                  <select
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  >
                    <option value="Entry Level">Entry Level</option>
                    <option value="1-2 Years">1-2 Years</option>
                    <option value="3-5 Years">3-5 Years</option>
                    <option value="Senior Lead">Senior Lead</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Age <span className="text-slate-600">(optional)</span></label>
                  <input
                    type="number"
                    min="18"
                    max="70"
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 24"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Gender <span className="text-slate-600">(optional)</span></label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                  >
                    <option value="">Not Specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Profile Photo URL <span className="text-slate-600">(optional)</span></label>
                <input
                  type="text"
                  value={profilePhoto}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Entrance Foyer Station</label>
                <select
                  value={assignedGateId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAssignedGateId(val ? Number(val) : null);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-semibold"
                >
                  <option value="">None (Unassigned Reserve)</option>
                  {gatesMetrics.map((g) => (
                    <option key={g.gate_id} value={g.gate_id}>{g.gate_name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-6 text-sm font-semibold text-white bg-primary hover:bg-blue-750 border border-primary/45 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center"
              >
                <span>Deploy Roster</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 📊 Admin Volunteer Monitoring Dashboard Section */}
      {monitoringData && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 glass space-y-6">
          
          {/* Section Header with tab selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-outfit font-black text-slate-100 text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary animate-pulse" />
                Live Staff Monitoring Dashboard
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Real-time tracking of staff check-ins, shift sessions, activity feeds, and AI dispatch requests.
              </p>
            </div>
            
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { id: 'roster', label: 'Live Status' },
                { id: 'activities', label: 'Activity Logs' },
                { id: 'requests', label: 'AI Dispatches' },
                { id: 'reports', label: 'Daily Reports' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMonitorTab(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${
                    monitorTab === tab.id
                      ? 'bg-primary text-white shadow-md border border-primary/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mini KPI Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: 'Total Staff', count: monitoringData.kpis.total, color: 'text-slate-300' },
              { label: 'Active Today', count: monitoringData.kpis.active, color: 'text-emerald-400' },
              { label: 'Available (Rdy)', count: monitoringData.kpis.available, color: 'text-green-400' },
              { label: 'Busy (On Gate)', count: monitoringData.kpis.busy, color: 'text-red-400' },
              { label: 'On Break', count: monitoringData.kpis.break, color: 'text-amber-400' },
              { label: 'Offline / Abs', count: monitoringData.kpis.offline, color: 'text-slate-500' }
            ].map((kpi, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-850 bg-slate-950/40 flex flex-col justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{kpi.label}</span>
                <span className={`font-outfit text-xl font-black mt-1 ${kpi.color}`}>{kpi.count}</span>
              </div>
            ))}
          </div>

          {/* Roster Live Status Tab */}
          {monitorTab === 'roster' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-400" /> Current Shift Sessions &amp; Activity
                </h4>
              </div>
              <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/20">
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-850 bg-slate-900/40">
                    <tr>
                      <th className="p-3.5">Volunteer</th>
                      <th className="p-3.5">Assigned Station</th>
                      <th className="p-3.5 text-center">Roster Status</th>
                      <th className="p-3.5 text-center">Attendance</th>
                      <th className="p-3.5">Check-In</th>
                      <th className="p-3.5">Check-Out</th>
                      <th className="p-3.5 text-center">Total Hours</th>
                      <th className="p-3.5">Current Assignment</th>
                      <th className="p-3.5 text-center">Checklist</th>
                      <th className="p-3.5 text-center">Incidents</th>
                      <th className="p-3.5 text-right">Active Session</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40">
                    {monitoringData.roster.map((r, i) => {
                      const hours = Math.floor(r.session_duration_seconds / 3600);
                      const mins = Math.floor((r.session_duration_seconds % 3600) / 60);
                      const durationStr = r.status === 'Offline'
                        ? 'Inactive'
                        : `${hours > 0 ? `${hours}h ` : ''}${mins}m`;
                      
                      const checkInTimeStr = r.check_in_time ? r.check_in_time.split(' ')[1]?.slice(0, 5) || r.check_in_time : '—';
                      const checkOutTimeStr = r.check_out_time ? r.check_out_time.split(' ')[1]?.slice(0, 5) || r.check_out_time : '—';
                      
                      return (
                        <tr key={i} className="hover:bg-slate-950/30">
                          <td className="p-3.5 font-bold text-slate-100 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => fetchVolunteerDetails(r.volunteer_id)}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              r.status === 'Available' ? 'bg-green-500 animate-pulse' :
                              r.status === 'Busy' ? 'bg-red-500 animate-pulse' :
                              r.status === 'En Route' ? 'bg-blue-500 animate-pulse' :
                              r.status === 'Pending' ? 'bg-amber-500 animate-pulse' :
                              r.status === 'Arrived' ? 'bg-teal-500 animate-pulse' :
                              r.status === 'Break' ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'
                            }`} />
                            <div>
                              <div>{r.volunteer_name}</div>
                              <div className="text-[10px] text-slate-550 font-bold">{r.email || r.phone}</div>
                            </div>
                          </td>
                          <td className="p-3.5 font-medium text-slate-300">{r.gate_name}</td>
                          <td className="p-3.5 text-center">
                            <select
                              value={r.status}
                              onChange={(e) => handleStatusChange(r.volunteer_id, r.volunteer_name, r.contact || '', r.assigned_gate, e.target.value)}
                              className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border bg-slate-950 focus:outline-none cursor-pointer ${
                                r.status === 'Available' ? 'border-green-500/30 text-green-400' :
                                r.status === 'Busy' ? 'border-red-500/30 text-red-400' :
                                r.status === 'En Route' ? 'border-blue-500/30 text-blue-400' :
                                r.status === 'Pending' ? 'border-amber-500/30 text-amber-400' :
                                r.status === 'Arrived' ? 'border-teal-500/30 text-teal-400' :
                                r.status === 'Break' ? 'border-amber-500/30 text-amber-400' :
                                'border-slate-700 text-slate-500'
                              }`}
                            >
                              <option value="Available">Available</option>
                              <option value="Busy">Busy</option>
                              <option value="Break">Break</option>
                              <option value="Offline">Offline</option>
                              <option value="Pending" disabled>Pending</option>
                              <option value="Accepted" disabled>Accepted</option>
                              <option value="En Route" disabled>En Route</option>
                              <option value="Arrived" disabled>Arrived</option>
                            </select>
                          </td>
                          <td className="p-3.5 text-center font-semibold">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              r.attendance_status === 'Checked In'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : r.attendance_status === 'Checked Out'
                                ? 'bg-indigo-500/10 text-indigo-400'
                                : 'bg-slate-800 text-slate-500'
                            }`}>
                              {r.attendance_status || 'Absent'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-400 text-[10px]">{checkInTimeStr}</td>
                          <td className="p-3.5 font-mono text-slate-400 text-[10px]">{checkOutTimeStr}</td>
                          <td className="p-3.5 text-center font-bold text-slate-300">{r.total_working_hours}h</td>
                          <td className="p-3.5 text-slate-400 text-[10px] max-w-[130px] truncate" title={r.current_assignment}>{r.current_assignment}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              r.checklist_status === 'Submitted' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {r.checklist_status}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              r.incident_count > 0 ? 'bg-rose-500/20 text-rose-450 border border-rose-500/20' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {r.incident_count}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-200">{durationStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Logs Tab */}
          {monitorTab === 'activities' && (
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-primary" /> Live Operational Activity Feed
              </h4>
              <div className="max-h-[400px] overflow-y-auto border border-slate-850 rounded-xl bg-slate-950/20 p-5 space-y-4">
                {monitoringData.activity_logs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-10 font-semibold">No activity logs recorded yet.</p>
                ) : (
                  <div className="relative border-l border-slate-850 ml-3.5 space-y-6">
                    {monitoringData.activity_logs.map((log, i) => {
                      const isAccept = log.activity_type.includes('Accept') || log.activity_type.includes('Check In') || log.activity_type.includes('Login') || log.activity_type.includes('Arrived') || log.activity_type.includes('Duty Started') || log.activity_type.includes('Deficit Reduced');
                      const isEnRoute = log.activity_type.includes('En Route');
                      const isReject = log.activity_type.includes('Reject');
                      const isLogout = log.activity_type.includes('Logout') || log.activity_type.includes('Offline');
                      const isCreated = log.activity_type.includes('Created') || log.activity_type.includes('Proposed') || log.activity_type.includes('Sent') || log.activity_type.includes('Assignment Sent');
                      
                      const iconBg = isAccept ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                     isEnRoute ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                     isReject ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                     isLogout ? 'bg-slate-800 border-slate-700 text-slate-400' :
                                     isCreated ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                     'bg-primary/10 border-primary/30 text-primary';
                                     
                      return (
                        <div key={i} className="relative pl-6 group">
                          {/* Timeline dot */}
                          <div className={`absolute -left-3.5 top-0.5 w-7 h-7 rounded-full border flex items-center justify-center text-[10px] ${iconBg}`}>
                            {isAccept ? '✓' : isEnRoute ? '→' : isReject ? '✗' : isLogout ? '○' : isCreated ? '+' : '►'}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-xs">
                              <span className="font-bold text-slate-200">{log.volunteer_name}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase border ${iconBg}`}>
                                {log.activity_type}
                              </span>
                              {log.gate_name && log.gate_name !== 'N/A' && (
                                <span className="text-[10px] text-slate-500 font-semibold">@{log.gate_name}</span>
                              )}
                              <span className="text-[9px] text-slate-650 font-mono font-medium ml-auto">{log.timestamp}</span>
                            </div>
                            <p className="text-slate-400 text-[11px] font-semibold">{log.details}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dispatch requests Tab */}
          {monitorTab === 'requests' && (
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" /> AI-Driven Volunteer Dispatch logs
              </h4>
              <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/20">
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-850 bg-slate-900/40">
                    <tr>
                      <th className="p-3.5">Volunteer</th>
                      <th className="p-3.5">From Gate</th>
                      <th className="p-3.5">To Gate</th>
                      <th className="p-3.5 text-center">Priority</th>
                      <th className="p-3.5">Reason / Suggestion</th>
                      <th className="p-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40">
                    {monitoringData.assignment_requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-slate-500 font-semibold">
                          No dispatch requests generated by the auto-allocation engine.
                        </td>
                      </tr>
                    ) : (
                      monitoringData.assignment_requests.map((req, i) => (
                        <tr key={i} className="hover:bg-slate-950/30">
                          <td className="p-3.5 font-bold text-slate-100">{req.volunteer_name}</td>
                          <td className="p-3.5 text-slate-300 font-medium">{req.from_gate_name}</td>
                          <td className="p-3.5 text-slate-100 font-black">{req.to_gate_name}</td>
                          <td className="p-3.5 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              req.priority === 'Critical' ? 'bg-red-500/10 text-red-400' :
                              req.priority === 'High' ? 'bg-orange-500/10 text-orange-400' :
                              req.priority === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400 font-medium max-w-[200px] truncate" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="p-3.5 text-right font-bold">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                              req.status === 'Completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                              req.status === 'Arrived' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                              req.status === 'Accepted' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                              req.status === 'En Route' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' :
                              req.status === 'Rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                              req.status === 'Pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse' :
                              'bg-slate-800 border-slate-700 text-slate-500'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Daily Reports Tab */}
          {monitorTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Daily Shift Reports Log
                </h4>
                <input
                  type="text"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search by volunteer name, gate, or tasks..."
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-xs text-slate-300 font-semibold max-w-xs w-full"
                />
              </div>

              {loadingReports ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-t-primary border-slate-850 rounded-full animate-spin" />
                </div>
              ) : dailyReports.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-bold border border-dashed border-slate-850 rounded-xl">
                  No daily reports found matching search criteria.
                </div>
              ) : (
                <div className="space-y-4">
                  {dailyReports.map((rep) => (
                    <div key={rep.report_id} className="p-4 rounded-xl border border-slate-850 bg-slate-955/20 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2">
                        <div>
                          <strong className="text-xs text-slate-100 font-outfit">{rep.volunteer_name}</strong>
                          <span className="text-[10px] text-slate-500 font-bold ml-2 uppercase">Gate: {rep.gate_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-medium">Filed: {rep.submitted_at}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">Tasks Performed</span>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">{rep.tasks}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase text-slate-550 tracking-wider">Issues Encountered</span>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">{rep.issues_faced}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium border-t border-slate-900 pt-3">
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold uppercase text-slate-550 tracking-wider">Actions protocol Taken</span>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">{rep.action_taken}</p>
                        </div>
                        {rep.suggestions && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">Suggestions / Remarks</span>
                            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-900">{rep.suggestions}</p>
                          </div>
                        )}
                      </div>

                      {rep.additional_notes && (
                        <div className="text-xs pt-2 border-t border-slate-900/60">
                          <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">Additional Remarks</span>
                          <p className="text-slate-400 mt-1 italic leading-relaxed">{rep.additional_notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detailed Volunteer View Modal */}
      {selectedVolId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setSelectedVolId(null); setVolDetails(null); }}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-t-primary border-slate-850 rounded-full animate-spin mb-3" />
                <p className="text-xs text-slate-400 font-medium">Fetching detailed stats registry...</p>
              </div>
            ) : detailsError ? (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold my-10">
                {detailsError}
              </div>
            ) : volDetails ? (
              <div className="space-y-6">
                
                {/* Header card info */}
                <div className="flex flex-col md:flex-row items-center gap-5 pb-6 border-b border-slate-800">
                  <div className="w-20 h-20 rounded-full border-2 border-slate-800 overflow-hidden bg-slate-955 flex items-center justify-center flex-shrink-0">
                    {volDetails.profile_photo ? (
                      <img src={volDetails.profile_photo} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-black text-primary font-outfit">
                        {volDetails.volunteer_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 text-center md:text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                      <h3 className="font-outfit text-xl font-black text-slate-100">{volDetails.volunteer_name}</h3>
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-primary/10 border border-primary/20 text-primary rounded-full">
                        {volDetails.experience}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        volDetails.status === 'Available' ? 'bg-green-500 animate-pulse' :
                        volDetails.status === 'Busy' ? 'bg-red-500 animate-pulse' :
                        volDetails.status === 'Break' ? 'bg-amber-500 animate-pulse' :
                        'bg-slate-655'
                      }`} />
                      <span className="text-[10px] text-slate-450 font-bold uppercase">{volDetails.status}</span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1">
                      Joined: <strong className="text-slate-300 font-semibold">{volDetails.joining_date}</strong>
                      {' | '}Gate: <strong className="text-primary font-bold">{volDetails.gate_name}</strong>
                      {' | '}Role: <strong className="text-slate-300 font-semibold capitalize">{volDetails.role}</strong>
                    </p>

                    {/* Identity grid */}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{volDetails.email || 'N/A'}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <PhoneCall className="w-3 h-3 flex-shrink-0" />
                        <span className="font-mono">{volDetails.phone || 'N/A'}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Lock className="w-3 h-3 flex-shrink-0" />
                        Username: <strong className="text-slate-300 font-mono ml-1">{volDetails.username || 'N/A'}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        Emergency: <strong className="text-slate-300 font-mono ml-1">{volDetails.emergency_contact || 'N/A'}</strong>
                      </span>
                      {(volDetails.age || volDetails.gender) && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <UserCheck className="w-3 h-3 flex-shrink-0" />
                          {volDetails.age ? `Age: ${volDetails.age}` : ''}{volDetails.age && volDetails.gender ? ' · ' : ''}{volDetails.gender || ''}
                        </span>
                      )}
                      {volDetails.last_login && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          Last Login: <strong className="text-slate-300 font-mono ml-1 text-[10px]">{volDetails.last_login}</strong>
                        </span>
                      )}
                      {volDetails.last_logout && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          Last Logout: <strong className="text-slate-300 font-mono ml-1 text-[10px]">{volDetails.last_logout}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Send Quick Reminders Panel */}
                  <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                    <span className="text-[9px] font-extrabold uppercase text-slate-550 tracking-wider text-center block">Dispatch Reminders</span>
                    <div className="flex gap-2">
                      {['Checklist', 'Work Report'].map((type) => (
                        <button
                          key={type}
                          onClick={() => handleSendReminder(type)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-extrabold text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Checklists Submitted', count: volDetails.stats.checklists_submitted, color: 'text-primary' },
                    { label: 'Incidents Reported', count: volDetails.stats.incidents_reported, color: 'text-red-400' },
                    { label: 'Assignments Done', count: volDetails.stats.assignments_completed, color: 'text-emerald-400' },
                    { label: 'Total Hours', count: `${volDetails.stats.total_hours}h`, color: 'text-indigo-400' },
                    { label: 'Days Present', count: volDetails.stats.total_days_present ?? 0, color: 'text-amber-400' },
                    { label: 'Operator Score', count: `${volDetails.stats.operator_score}/100`, color: 'text-pink-400 font-black' },
                  ].map((stat, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">{stat.label}</span>
                      <span className={`text-sm font-bold block mt-1 ${stat.color}`}>{stat.count}</span>
                    </div>
                  ))}
                </div>
                {/* Current shift status & Assignment details */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {volDetails.current_shift_status && volDetails.current_shift_status !== 'Not checked in' && (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      {volDetails.current_shift_status}
                    </div>
                  )}

                  {volDetails.current_assignment ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
                      <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span>Active Redeployment: <strong>{volDetails.current_assignment.to_gate_name}</strong> ({volDetails.current_assignment.status})</span>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-850 text-slate-500 text-xs font-semibold">
                      <span>No active redeployment dispatches.</span>
                    </div>
                  )}
                </div>

                {/* Tab layout details section */}
                <div className="space-y-4">
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850 max-w-md">
                    {[
                      { id: 'timeline', label: 'Timeline Feed' },
                      { id: 'attendance', label: 'Attendance' },
                      { id: 'checklists', label: 'Checklists' },
                      { id: 'reports', label: 'Reports' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setDetailsTab(tab.id as any)}
                        className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          detailsTab === tab.id
                            ? 'bg-primary text-white shadow-md border border-primary/20'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab Render Content */}
                  <div className="min-h-[200px] border border-slate-850 rounded-xl bg-slate-950/20 p-4">
                    
                    {/* 1. Timeline Feed */}
                    {detailsTab === 'timeline' && (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {volDetails.timeline.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-10 font-bold">No activity logs recorded.</p>
                        ) : (
                          volDetails.timeline.map((item: any, idx: number) => (
                            <div key={idx} className="flex gap-3 text-xs leading-relaxed">
                              <span className="font-mono text-slate-500 font-medium whitespace-nowrap">{item.timestamp}</span>
                              <span className="font-extrabold text-primary whitespace-nowrap">[{item.activity_type}]</span>
                              <span className="text-slate-350 font-semibold">{item.details}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* 2. Attendance history */}
                    {detailsTab === 'attendance' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-400">
                          <thead className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-800">
                            <tr>
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Check In</th>
                              <th className="pb-2">Check Out</th>
                              <th className="pb-2 text-right">Duration (Hours)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/40">
                            {volDetails.attendance_history.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-6 text-center text-xs text-slate-500 font-bold">No attendance records found.</td>
                              </tr>
                            ) : (
                              volDetails.attendance_history.map((att: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-950/30">
                                  <td className="py-2.5 font-bold text-slate-300">{att.date}</td>
                                  <td className="py-2.5 text-slate-400 font-mono">{att.check_in_time || '—'}</td>
                                  <td className="py-2.5 text-slate-400 font-mono">{att.check_out_time || '—'}</td>
                                  <td className="py-2.5 text-right font-black text-slate-200">{att.duration_hours} hrs</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 3. Checklist inspections */}
                    {detailsTab === 'checklists' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-400">
                          <thead className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-800">
                            <tr>
                              <th className="pb-2">Inspection Date</th>
                              <th className="pb-2 text-center">Arrived</th>
                              <th className="pb-2 text-center">QR Scan</th>
                              <th className="pb-2 text-center">Barricades</th>
                              <th className="pb-2 text-center">Flow</th>
                              <th className="pb-2 text-center">Emerg. Exit</th>
                              <th className="pb-2 text-center">Comm. Device</th>
                              <th className="pb-2 text-center">Shift End</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/40">
                            {volDetails.checklists.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-6 text-center text-xs text-slate-500 font-bold">No safety checklist entries logged.</td>
                              </tr>
                            ) : (
                              volDetails.checklists.map((cl: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-950/30">
                                  <td className="py-2.5 font-bold text-slate-300">{cl.date}</td>
                                  {[
                                    cl.arrived_at_gate,
                                    cl.qr_scanner_working,
                                    cl.barricades_checked,
                                    cl.crowd_flow_normal,
                                    cl.emergency_exit_clear,
                                    cl.communication_device_checked,
                                    cl.shift_completed
                                  ].map((val, i) => (
                                    <td key={i} className="py-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${val === 1 ? 'bg-success/20 text-success' : 'bg-slate-800 text-slate-500'}`}>
                                        {val === 1 ? 'YES' : 'NO'}
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 4. Shift work reports */}
                    {detailsTab === 'reports' && (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                        {volDetails.work_reports.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-10 font-bold">No daily reports filed.</p>
                        ) : (
                          volDetails.work_reports.map((rep: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                <span className="font-bold text-xs text-primary font-outfit">Report date: {rep.date}</span>
                                <span className="text-[10px] text-slate-500 font-mono font-medium">Filed: {rep.submitted_at}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                                <p><strong className="text-slate-500">Crowd Situation:</strong> <span className="text-slate-300 font-semibold">{rep.crowd_situation}</span></p>
                              </div>
                              <p className="text-xs"><strong className="text-slate-400 block mb-1">Tasks Completed:</strong> <span className="text-slate-300 whitespace-pre-wrap leading-relaxed">{rep.tasks}</span></p>
                              <p className="text-xs"><strong className="text-slate-400 block mb-1">Issues Faced:</strong> <span className="text-slate-300 whitespace-pre-wrap leading-relaxed">{rep.issues_faced}</span></p>
                              <p className="text-xs"><strong className="text-slate-400 block mb-1">Actions Taken:</strong> <span className="text-slate-300 whitespace-pre-wrap leading-relaxed">{rep.action_taken}</span></p>
                              {rep.suggestions && <p className="text-xs"><strong className="text-slate-400 block mb-1">Suggestions:</strong> <span className="text-slate-300 whitespace-pre-wrap leading-relaxed">{rep.suggestions}</span></p>}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  </div>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

    </div>
  );
};
export default Volunteers;