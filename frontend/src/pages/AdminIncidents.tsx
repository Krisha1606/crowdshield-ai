import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  User, 
  MapPin, 
  Calendar, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  Info, 
  ShieldAlert, 
  Clock,
  Check,
  Download,
  ExternalLink,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import api, { getApiBaseUrl } from '../services/api';
import { Incident } from '../types';

export const AdminIncidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const getPhotoUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${getApiBaseUrl()}/${url}`;
  };

  const handleDownloadImage = async (pUrl: string) => {
    try {
      const fullUrl = getPhotoUrl(pUrl);
      const resp = await fetch(fullUrl);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pUrl.split('/').pop() || 'incident_photo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(getPhotoUrl(pUrl), '_blank');
    }
  };

  const fetchIncidents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      setError(null);
      const response = await api.get('/incidents');
      setIncidents(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load field incidents database.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Poll for new incidents
  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(() => {
      fetchIncidents(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleResolveIncident = async (incidentId: number) => {
    setResolvingId(incidentId);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/incidents/${incidentId}/resolve`);
      setSuccess(`Incident #${incidentId} has been successfully resolved.`);
      await fetchIncidents(true);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to resolve the incident.');
    } finally {
      setResolvingId(null);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, severityFilter, typeFilter]);

  // Compute Statistics
  const totalIncidents = incidents.length;
  const activeIncidents = incidents.filter(i => !i.is_resolved).length;
  const resolvedIncidents = incidents.filter(i => i.is_resolved).length;
  const criticalHighIncidents = incidents.filter(i => !i.is_resolved && (i.severity === 'Critical' || i.severity === 'High')).length;

  // Filter Incidents List
  const filteredIncidents = incidents.filter(inc => {
    // 1. Search Query filter (matches location, description, or volunteer name)
    const matchesSearch = 
      (inc.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.volunteer_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Status Filter
    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = !inc.is_resolved;
    if (statusFilter === 'resolved') matchesStatus = !!inc.is_resolved;

    // 3. Severity Filter
    const matchesSeverity = severityFilter === 'all' || inc.severity === severityFilter;

    // 4. Incident Type Filter
    const matchesType = typeFilter === 'all' || inc.incident_type === typeFilter;

    return matchesSearch && matchesStatus && matchesSeverity && matchesType;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentIncidents = filteredIncidents.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Get Initials for Volunteer Avatar
  const getInitials = (name?: string) => {
    if (!name) return 'V';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Incident types list extracted dynamically or defined statically
  const incidentTypes = [
    'Crowd Congestion',
    'Scanner Failure',
    'Medical Emergency',
    'Barrier Breach',
    'Lost Property / Person',
    'Security Anomaly',
    'Other Issue'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-app-text">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold tracking-tight text-app-text dark:text-slate-100 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-danger/10 text-danger border border-danger/15">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </span>
            Incident Command Center
          </h2>
          <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">
            Real-time triaging, response management, and resolution of volunteer-reported security & operational issues.
          </p>
        </div>

        <button
          onClick={() => fetchIncidents(false)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-900/50 border border-slate-800 dark:bg-slate-900/60 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-800 hover:border-slate-700 transition-all focus:outline-none cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold shadow-sm">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold shadow-sm">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Statistics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat 1: Total */}
        <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-primary/10">
            <Info className="w-8 h-8 text-primary/30" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Incidents</span>
          <h3 className="text-3xl font-extrabold text-app-text mt-1">{totalIncidents}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-2 flex items-center gap-1">
            <span>Overall reports registered today</span>
          </p>
        </div>

        {/* Stat 2: Active */}
        <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-danger/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-danger/10">
            <AlertTriangle className="w-8 h-8 text-danger/30" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Active Incidents</span>
          <h3 className="text-3xl font-extrabold text-danger mt-1 flex items-center gap-2">
            {activeIncidents}
            {activeIncidents > 0 && <span className="w-2.5 h-2.5 rounded-full bg-danger animate-ping" />}
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-2">
            Requires dispatcher triage
          </p>
        </div>

        {/* Stat 3: Resolved */}
        <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-success/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-success/10">
            <CheckCircle className="w-8 h-8 text-success/30" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Resolved Incidents</span>
          <h3 className="text-3xl font-extrabold text-success mt-1">{resolvedIncidents}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-2">
            {totalIncidents > 0 ? `${Math.round((resolvedIncidents / totalIncidents) * 100)}% resolution rate` : '0% resolution rate'}
          </p>
        </div>

        {/* Stat 4: Critical/High */}
        <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-orange-550/10">
            <ShieldAlert className="w-8 h-8 text-orange-500/30" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Critical / High Threat</span>
          <h3 className="text-3xl font-extrabold text-orange-400 mt-1">{criticalHighIncidents}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-2">
            Unresolved severe emergencies
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-app-card border border-app-card-border rounded-2xl p-4 shadow-premium space-y-4">
        {/* Search and Main Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="w-4.5 h-4.5" />
            </span>
            <input
              type="text"
              placeholder="Search by volunteer, location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-app-card-border hover:border-slate-350 dark:hover:border-slate-800 focus:border-primary focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium transition-all"
            />
          </div>

          {/* Filtering Dropdowns */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            {/* Severity Filter */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-app-card-border rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-app-text focus:outline-none border-none pr-6 cursor-pointer"
              >
                <option value="all">All Severities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-app-card-border rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-app-text focus:outline-none border-none pr-6 cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              >
                <option value="all">All Types</option>
                {incidentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tab Controls for Status Filter */}
        <div className="border-t border-app-card-border/60 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-app-card-border/80 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-app-card text-app-text shadow-sm border border-app-card-border/20'
                  : 'text-slate-500 hover:text-app-text'
              }`}
            >
              All Reports ({filteredIncidents.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-app-card text-app-text shadow-sm border border-app-card-border/20'
                  : 'text-slate-500 hover:text-app-text'
              }`}
            >
              Active ({filteredIncidents.filter(i => !i.is_resolved).length})
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'resolved'
                  ? 'bg-app-card text-app-text shadow-sm border border-app-card-border/20'
                  : 'text-slate-500 hover:text-app-text'
              }`}
            >
              Resolved ({filteredIncidents.filter(i => i.is_resolved).length})
            </button>
          </div>

          <div className="text-xs font-semibold text-slate-550 dark:text-slate-400">
            Filtered: <span className="font-extrabold text-app-text">{filteredIncidents.length}</span> of {incidents.length} incident reports
          </div>
        </div>
      </div>

      {/* Incident Cards List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] bg-app-card border border-app-card-border rounded-2xl p-8">
          <div className="w-10 h-10 border-4 border-t-primary border-slate-200 dark:border-slate-800 rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-bold font-outfit">Retrieving field incident telemetry logs...</p>
        </div>
      ) : filteredIncidents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentIncidents.map((inc) => {
            const isCrit = inc.severity === 'Critical';
            const isHigh = inc.severity === 'High';
            const isMed = inc.severity === 'Medium';

            return (
              <div 
                key={inc.incident_id} 
                className={`bg-app-card border border-app-card-border rounded-2xl shadow-premium p-5 flex flex-col justify-between transition-all duration-300 hover:border-slate-350 dark:hover:border-slate-850 ${
                  !inc.is_resolved && (isCrit || isHigh) 
                    ? 'ring-1 ring-danger/25' 
                    : ''
                }`}
              >
                <div>
                  {/* Card Header: Type, Severity and Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                        isCrit 
                          ? 'bg-danger/15 border-danger/35 text-danger animate-pulse' 
                          : isHigh 
                          ? 'bg-danger/10 border-danger/20 text-danger' 
                          : isMed 
                          ? 'bg-warning/10 border-warning/25 text-warning' 
                          : 'bg-success/10 border-success/25 text-success'
                      }`}>
                        {inc.severity}
                      </span>
                      {inc.is_resolved ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-success/5 border-success/15 text-success flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Resolved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-ping" /> Active
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-bold font-mono">
                      #{inc.incident_id}
                    </span>
                  </div>

                  {/* Incident Type */}
                  <h4 className="font-outfit text-base font-bold text-app-text mb-3">
                    {inc.incident_type}
                  </h4>

                  {/* Incident Location & Timestamp */}
                  <div className="space-y-1.5 text-xs font-semibold text-slate-550 dark:text-slate-500 mb-4">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>{inc.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>
                        {inc.created_at 
                          ? new Date(inc.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
                          : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {/* Reporter details */}
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-app-card-border mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-premium flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0 shadow-sm">
                      {getInitials(inc.volunteer_name)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[9px] text-slate-550 dark:text-slate-500 font-bold uppercase tracking-wider">Reporter Name</p>
                      <p className="text-xs font-bold text-app-text truncate">{inc.volunteer_name || 'Anonymous'}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-550 dark:text-slate-400 font-semibold leading-relaxed mb-4 whitespace-pre-wrap">
                    {inc.description}
                  </p>
                </div>

                {/* Card Attachment & Actions */}
                <div className="space-y-4 pt-3 border-t border-app-card-border/60">
                  {/* Photo Preview Section */}
                  {inc.photo_url ? (
                    <div className="relative group/image overflow-hidden rounded-xl border border-app-card-border bg-slate-950 flex items-center justify-center">
                      <img 
                        src={getPhotoUrl(inc.photo_url)} 
                        alt={`Attachment for incident #${inc.incident_id}`} 
                        className="w-full h-32 object-cover opacity-85 group-hover/image:opacity-100 transition-opacity" 
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 flex items-center justify-center gap-3 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={() => setEnlargedImage(getPhotoUrl(inc.photo_url))}
                          className="p-2 bg-slate-900/90 text-white rounded-lg hover:bg-slate-800 transition-all border border-slate-700 cursor-pointer"
                          title="Preview Image"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadImage(inc.photo_url!)}
                          className="p-2 bg-slate-900/90 text-white rounded-lg hover:bg-slate-800 transition-all border border-slate-700 cursor-pointer"
                          title="Download Image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-app-card-border/80 text-center text-[10px] text-slate-500 font-bold">
                      No photo attachment provided
                    </div>
                  )}

                  {/* Action Button */}
                  {!inc.is_resolved ? (
                    <button
                      onClick={() => handleResolveIncident(inc.incident_id!)}
                      disabled={resolvingId === inc.incident_id}
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-danger hover:bg-red-650 active:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg border border-danger/35 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {resolvingId === inc.incident_id ? (
                        <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>Resolve Incident</span>
                    </button>
                  ) : (
                    <div className="py-2.5 px-4 rounded-xl border border-success/15 bg-success/5 text-success text-center text-xs font-extrabold flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      <span>Resolved by Command Center</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-app-card border border-app-card-border rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-premium">
          <AlertCircle className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" />
          <h4 className="text-base font-bold text-app-text mb-1">No Incident Reports Match Filters</h4>
          <p className="text-xs text-slate-500 max-w-sm">
            Try adjusting your search query, status filters, or severity constraints to view other dispatch logs.
          </p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-app-card border border-app-card-border rounded-2xl p-4 shadow-premium">
          <span className="text-xs font-semibold text-slate-500">
            Showing <span className="font-bold text-app-text">{indexOfFirstItem + 1}</span> to{' '}
            <span className="font-bold text-app-text">
              {Math.min(indexOfLastItem, filteredIncidents.length)}
            </span>{' '}
            of <span className="font-bold text-app-text">{filteredIncidents.length}</span> reports
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-app-card-border text-slate-500 hover:text-app-text hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-500 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
              <button
                key={number}
                onClick={() => paginate(number)}
                className={`w-9 h-9 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                  currentPage === number
                    ? 'bg-gradient-premium border-transparent text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-950 border-app-card-border text-slate-500 hover:text-app-text hover:bg-slate-100'
                }`}
              >
                {number}
              </button>
            ))}

            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-app-card-border text-slate-500 hover:text-app-text hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-500 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Enlarged Photo Preview Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" 
          onClick={() => setEnlargedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[85vh] bg-app-card border border-app-card-border rounded-2xl overflow-hidden p-3 shadow-2xl flex flex-col items-center justify-center" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full transition-colors font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            <img src={enlargedImage} alt="Enlarged preview" className="max-w-full max-h-[70vh] object-contain rounded-lg border border-app-card-border" />
            
            <div className="mt-4 flex justify-between gap-4 w-full px-2 text-xs">
              <a 
                href={enlargedImage} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-app-card-border text-app-text rounded-lg transition-colors font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = enlargedImage;
                  link.download = enlargedImage.split('/').pop() || 'download';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg transition-colors font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminIncidents;
