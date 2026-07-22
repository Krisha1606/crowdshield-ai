import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Users,
  Download,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  CheckSquare,
  Cpu,
  Clock,
  ArrowUpRight,
  Activity,
  Info,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Award,
  ShieldAlert,
  MapPin,
  CheckCircle2,
  ListTodo,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';

interface DailyReport {
  report_id: number;
  volunteer_name: string;
  gate_name: string;
  date: string;
  tasks: string;
  crowd_situation: string;
  issues_faced: string;
  action_taken: string;
  suggestions: string;
  additional_notes: string;
  submitted_at: string;
}

interface VolunteerPerformance {
  volunteer_id: number;
  volunteer_name: string;
  assigned_gate: number | null;
  gate_name: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  stats: {
    checklists_submitted: number;
    incidents_reported: number;
    assignments_completed: number;
    total_hours: number;
    total_days_present: number;
    operator_score: number;
  };
}

export const AdminReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'performance'>('reports');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [performances, setPerformances] = useState<VolunteerPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected Report for Detail Drawer/Modal
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  // Daily Reports Filters State
  const [reportSearch, setReportSearch] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [reportGate, setReportGate] = useState('all');
  const [reportFlaggedOnly, setReportFlaggedOnly] = useState(false);

  // Performance Scoreboard Filters State
  const [perfSearch, setPerfSearch] = useState('');
  const [perfRatingFilter, setPerfRatingFilter] = useState<'all' | 'excellent' | 'good' | 'needs_improvement'>('all');

  // Load daily work reports
  const fetchDailyReports = useCallback(async () => {
    try {
      const res = await api.get('/admin/daily-reports');
      setReports(res.data || []);
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to retrieve daily reports logs.');
    }
  }, []);

  // Load volunteers performance scores (retrieves volunteers list then fetches details in parallel)
  const fetchVolunteerPerformances = useCallback(async () => {
    try {
      const volsRes = await api.get('/volunteers');
      const volList = volsRes.data || [];
      
      const enrichedPerformances = await Promise.all(
        volList.map(async (v: any) => {
          try {
            const detailRes = await api.get(`/admin/volunteers/${v.volunteer_id}`);
            const data = detailRes.data;
            return {
              volunteer_id: v.volunteer_id,
              volunteer_name: v.volunteer_name,
              assigned_gate: v.assigned_gate,
              gate_name: data.gate_name || 'Reserve Pool',
              status: v.status || 'Offline',
              email: v.email,
              phone: v.phone,
              stats: {
                checklists_submitted: data.stats?.checklists_submitted || 0,
                incidents_reported: data.stats?.incidents_reported || 0,
                assignments_completed: data.stats?.checklists_submitted ? Math.max(0, Math.floor(data.stats.checklists_submitted / 2)) : 0, // Fallback calculation if missing
                total_hours: data.stats?.total_hours || (data.stats?.checklists_submitted || 0) * 8, // Estimate 8 hours per checklist submitted
                total_days_present: data.stats?.total_days_present || data.stats?.checklists_submitted || 0,
                operator_score: data.stats?.operator_score || 80
              }
            };
          } catch {
            return {
              volunteer_id: v.volunteer_id,
              volunteer_name: v.volunteer_name,
              assigned_gate: v.assigned_gate,
              gate_name: 'Reserve Pool',
              status: v.status || 'Offline',
              stats: {
                checklists_submitted: 0,
                incidents_reported: 0,
                assignments_completed: 0,
                total_hours: 0,
                total_days_present: 0,
                operator_score: 80
              }
            };
          }
        })
      );
      setPerformances(enrichedPerformances);
    } catch (err: any) {
      console.error(err);
      throw new Error('Failed to retrieve volunteer scoreboard.');
    }
  }, []);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      if (activeTab === 'reports') {
        await fetchDailyReports();
      } else {
        await fetchVolunteerPerformances();
      }
    } catch (err: any) {
      setError(err.message || 'Database synchronization error.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [activeTab, fetchDailyReports, fetchVolunteerPerformances]);

  useEffect(() => {
    loadData();
    // Poll updates every 10 seconds
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Extract unique gates from reports for report filter dropdown
  const reportGateOptions = useMemo(() => {
    const gatesSet = new Set<string>();
    reports.forEach(r => {
      if (r.gate_name) gatesSet.add(r.gate_name);
    });
    return Array.from(gatesSet);
  }, [reports]);

  // Filter Daily Reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 1. Search Query (volunteer, gate, tasks, issues)
      const query = reportSearch.toLowerCase();
      const matchesSearch =
        (r.volunteer_name || '').toLowerCase().includes(query) ||
        (r.gate_name || '').toLowerCase().includes(query) ||
        (r.tasks || '').toLowerCase().includes(query) ||
        (r.issues_faced || '').toLowerCase().includes(query);

      // 2. Date Filter
      const matchesDate = !reportDate || r.date === reportDate;

      // 3. Gate Filter
      const matchesGate = reportGate === 'all' || r.gate_name === reportGate;

      // 4. Flagged (Issues Faced) Filter
      let matchesFlagged = true;
      if (reportFlaggedOnly) {
        const issues = (r.issues_faced || '').trim().toLowerCase();
        matchesFlagged = issues.length > 0 && issues !== 'none' && issues !== 'no' && issues !== 'n/a';
      }

      return matchesSearch && matchesDate && matchesGate && matchesFlagged;
    });
  }, [reports, reportSearch, reportDate, reportGate, reportFlaggedOnly]);

  // Filter Performances
  const filteredPerformances = useMemo(() => {
    return performances.filter(p => {
      // 1. Search query (volunteer name or gate name)
      const query = perfSearch.toLowerCase();
      const matchesSearch =
        (p.volunteer_name || '').toLowerCase().includes(query) ||
        (p.gate_name || '').toLowerCase().includes(query);

      // 2. Performance Rating Filter
      let matchesRating = true;
      const score = p.stats.operator_score;
      if (perfRatingFilter === 'excellent') matchesRating = score >= 90;
      if (perfRatingFilter === 'good') matchesRating = score >= 70 && score < 90;
      if (perfRatingFilter === 'needs_improvement') matchesRating = score < 70;

      return matchesSearch && matchesRating;
    });
  }, [performances, perfSearch, perfRatingFilter]);

  // Compute Daily Reports Stats
  const reportsStats = useMemo(() => {
    const total = reports.length;
    const flagged = reports.filter(r => {
      const issues = (r.issues_faced || '').trim().toLowerCase();
      return issues.length > 0 && issues !== 'none' && issues !== 'no' && issues !== 'n/a';
    }).length;
    
    const uniqueGates = new Set(reports.map(r => r.gate_name).filter(Boolean)).size;
    const suggestions = reports.filter(r => (r.suggestions || '').trim().length > 0).length;

    return { total, flagged, uniqueGates, suggestions };
  }, [reports]);

  // Compute Performances Stats
  const performancesStats = useMemo(() => {
    if (performances.length === 0) {
      return { avgScore: 0, totalChecklists: 0, totalAssignments: 0, topPerformer: 'N/A', topScore: 0 };
    }

    let sumScore = 0;
    let totalChecklists = 0;
    let totalAssignments = 0;
    let topScore = -1;
    let topPerformer = 'N/A';

    performances.forEach(p => {
      sumScore += p.stats.operator_score;
      totalChecklists += p.stats.checklists_submitted;
      totalAssignments += p.stats.assignments_completed;
      
      if (p.stats.operator_score > topScore) {
        topScore = p.stats.operator_score;
        topPerformer = p.volunteer_name;
      }
    });

    const avgScore = Math.round(sumScore / performances.length);

    return { avgScore, totalChecklists, totalAssignments, topPerformer, topScore };
  }, [performances]);

  // Export Data to CSV
  const handleExportCSV = () => {
    if (activeTab === 'reports') {
      const csvData = filteredReports.map(r => ({
        'Report ID': r.report_id,
        'Volunteer': r.volunteer_name,
        'Gate/Location': r.gate_name,
        'Date': r.date,
        'Tasks Completed': r.tasks,
        'Crowd Situation': r.crowd_situation,
        'Issues Faced': r.issues_faced,
        'Action Taken': r.action_taken,
        'Suggestions': r.suggestions,
        'Additional Notes': r.additional_notes,
        'Submitted At': r.submitted_at
      }));
      exportToCSV(csvData, `CrowdShield_Daily_Work_Reports_${new Date().toISOString().slice(0, 10)}.csv`);
    } else {
      const csvData = filteredPerformances.map(p => ({
        'Volunteer ID': p.volunteer_id,
        'Volunteer Name': p.volunteer_name,
        'Assigned Gate': p.gate_name,
        'Current Status': p.status,
        'Operator Score': p.stats.operator_score,
        'Checklists Submitted': p.stats.checklists_submitted,
        'Redeployments Completed': p.stats.assignments_completed,
        'Total Shift Hours': p.stats.total_hours,
        'Days Active': p.stats.total_days_present
      }));
      exportToCSV(csvData, `CrowdShield_Volunteer_Performance_Scoreboard_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(',')); // Headers row

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get Initials for Avatar
  const getInitials = (name?: string) => {
    if (!name) return 'V';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-app-text">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold tracking-tight text-app-text dark:text-slate-100 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/15">
              <FileText className="w-6 h-6" />
            </span>
            Operations Reports & Scores
          </h2>
          <p className="text-sm text-slate-550 dark:text-slate-400 mt-1">
            Analyze daily volunteer shift reports, audit duty checklist logs, and track individual volunteer execution scoreboard.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Refresh Feed */}
          <button
            onClick={() => loadData(false)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-900/50 border border-slate-800 dark:bg-slate-900/60 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer disabled:opacity-50 flex-1 md:flex-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Stats</span>
          </button>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={loading || (activeTab === 'reports' ? filteredReports.length === 0 : filteredPerformances.length === 0)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-850 disabled:text-slate-500 border border-emerald-600/30 text-white shadow-md transition-all cursor-pointer flex-1 md:flex-none"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-app-card-border/80 w-max">
        <button
          onClick={() => {
            setActiveTab('reports');
            setLoading(true);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-app-card text-app-text shadow-sm border border-app-card-border/20'
              : 'text-slate-500 hover:text-app-text'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Daily Work Reports</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('performance');
            setLoading(true);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-app-card text-app-text shadow-sm border border-app-card-border/20'
              : 'text-slate-500 hover:text-app-text'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Volunteer Scoreboard</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold shadow-sm">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards Section */}
      {activeTab === 'reports' ? (
        /* Daily Reports Summary Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Reports */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-primary/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-primary/10">
              <FileText className="w-7 h-7 text-primary/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Reports</span>
            <h3 className="text-3xl font-extrabold text-app-text mt-1">{reportsStats.total}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Logs received from field personnel</p>
          </div>

          {/* Card 2: Flagged Issues */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-danger/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-danger/10">
              <ShieldAlert className="w-7 h-7 text-danger/30 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Flagged Reports</span>
            <h3 className="text-3xl font-extrabold text-danger mt-1 flex items-center gap-1.5">
              {reportsStats.flagged}
              {reportsStats.flagged > 0 && <span className="w-2 h-2 rounded-full bg-danger animate-ping" />}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Reports outlining bottlenecks or failures</p>
          </div>

          {/* Card 3: Gate Coverage */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-500/10">
              <MapPin className="w-7 h-7 text-emerald-500/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Gate Coverage</span>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">{reportsStats.uniqueGates}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Unique security stations represented</p>
          </div>

          {/* Card 4: Suggestions */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-indigo-500/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-500/10">
              <TrendingUp className="w-7 h-7 text-indigo-500/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Suggestions filed</span>
            <h3 className="text-3xl font-extrabold text-indigo-400 mt-1">{reportsStats.suggestions}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Optimization suggestions submitted</p>
          </div>
        </div>
      ) : (
        /* Volunteer Performance Summary Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Average Score */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-primary/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-primary/10">
              <Award className="w-7 h-7 text-primary/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Avg Operator Score</span>
            <h3 className="text-3xl font-extrabold text-app-text mt-1">{performancesStats.avgScore}/100</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Overall cohort compliance and tasks execution</p>
          </div>

          {/* Card 2: Checklists */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-550/10">
              <CheckSquare className="w-7 h-7 text-emerald-500/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Checklists</span>
            <h3 className="text-3xl font-extrabold text-emerald-450 mt-1">{performancesStats.totalChecklists}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Safety check checklists compiled today</p>
          </div>

          {/* Card 3: Assignments */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-indigo-500/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-500/10">
              <Cpu className="w-7 h-7 text-indigo-500/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Redeployments Done</span>
            <h3 className="text-3xl font-extrabold text-indigo-400 mt-1">{performancesStats.totalAssignments}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2">Completed automated crowd redistribution shifts</p>
          </div>

          {/* Card 4: Top Performer */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-20 h-20 bg-pink-500/5 rounded-bl-full flex items-center justify-center transition-all duration-300 group-hover:bg-pink-500/10">
              <Award className="w-7 h-7 text-pink-500/30" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Top Performer</span>
            <h3 className="text-base font-extrabold text-pink-400 mt-1.5 truncate max-w-[160px]" title={performancesStats.topPerformer}>
              {performancesStats.topPerformer}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1.5">Score: <strong className="text-pink-400">{performancesStats.topScore}/100</strong></p>
          </div>
        </div>
      )}

      {/* Filter and Content Sections */}
      {activeTab === 'reports' ? (
        /* ──── Tab 1: DAILY REPORTS VIEW ──── */
        <div className="space-y-4">
          {/* Daily Reports Filters Panel */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-4 shadow-premium flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                placeholder="Search reports by volunteer, gate, tasks, or issues faced..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-app-card-border hover:border-slate-350 dark:hover:border-slate-800 focus:border-primary focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium transition-all"
              />
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
              {/* Date Filter */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-app-card-border rounded-xl px-3 py-1.5 w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-app-text focus:outline-none border-none cursor-pointer"
                />
                {reportDate && (
                  <button onClick={() => setReportDate('')} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Gate Filter */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-app-card-border rounded-xl px-3 py-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Gate:</span>
                <select
                  value={reportGate}
                  onChange={(e) => setReportGate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-app-text focus:outline-none border-none pr-6 cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all">All Gates</option>
                  {reportGateOptions.map(gate => (
                    <option key={gate} value={gate}>{gate}</option>
                  ))}
                </select>
              </div>

              {/* Flagged Switch */}
              <label className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-app-card-border rounded-xl px-3 py-2 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors w-full sm:w-auto justify-center sm:justify-start">
                <input
                  type="checkbox"
                  checked={reportFlaggedOnly}
                  onChange={(e) => setReportFlaggedOnly(e.target.checked)}
                  className="rounded border-slate-700 text-danger focus:ring-danger w-3.5 h-3.5"
                />
                <span className="text-xs font-bold text-slate-550 dark:text-slate-400 whitespace-nowrap">Only Flagged Issues</span>
              </label>
            </div>
          </div>

          {/* Daily Reports Cards Feed */}
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[30vh] bg-app-card border border-app-card-border rounded-2xl p-8">
              <div className="w-10 h-10 border-4 border-t-primary border-slate-200 dark:border-slate-800 rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-550 dark:text-slate-400 font-bold font-outfit">Loading reports logs database...</p>
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map(r => {
                const issues = (r.issues_faced || '').trim().toLowerCase();
                const isFlagged = issues.length > 0 && issues !== 'none' && issues !== 'no' && issues !== 'n/a';

                return (
                  <div
                    key={r.report_id}
                    onClick={() => setSelectedReport(r)}
                    className={`bg-app-card border border-app-card-border rounded-2xl p-5 shadow-premium hover:border-slate-350 dark:hover:border-slate-800 cursor-pointer transition-all duration-300 flex flex-col justify-between group ${
                      isFlagged ? 'ring-1 ring-danger/15' : ''
                    }`}
                  >
                    <div>
                      {/* Report header */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-[10px] text-slate-500 font-bold font-mono">
                          {r.date}
                        </span>
                        {isFlagged ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-danger/10 border-danger/20 text-danger flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Flagged Issue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border bg-success/5 border-success/15 text-success flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Normal Operations
                          </span>
                        )}
                      </div>

                      {/* Volunteer Reporter */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-gradient-premium flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm">
                          {getInitials(r.volunteer_name)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-bold text-app-text truncate">{r.volunteer_name}</h4>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{r.gate_name}</p>
                        </div>
                      </div>

                      {/* Core Tasks */}
                      <div className="space-y-1 mb-4 text-xs font-semibold text-slate-550 dark:text-slate-400">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Tasks Completed</span>
                        <p className="line-clamp-2 leading-relaxed text-app-text font-bold">
                          {r.tasks}
                        </p>
                      </div>

                      {/* Situation description summary */}
                      <div className="space-y-1 mb-4 text-xs font-semibold text-slate-550 dark:text-slate-400">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Crowd Situation</span>
                        <p className="line-clamp-2 leading-relaxed font-medium">
                          {r.crowd_situation}
                        </p>
                      </div>

                      {/* Issues faced (preview if flagged) */}
                      {isFlagged && (
                        <div className="p-2.5 rounded-xl bg-danger/5 border border-danger/10 text-xs font-semibold text-danger/90 mb-4">
                          <span className="text-[8px] font-black uppercase tracking-wider block text-danger">Reported Issue</span>
                          <p className="line-clamp-1 italic font-medium">
                            {r.issues_faced}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-app-card-border/60 flex items-center justify-between text-[10px] text-primary font-bold">
                      <span>View Full Details</span>
                      <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-app-card border border-app-card-border rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-premium">
              <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
              <h4 className="text-base font-bold text-app-text mb-1">No Daily Reports Found</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Try adjusting your search query, selecting another date, or resetting filters.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ──── Tab 2: VOLUNTEER PERFORMANCE VIEW ──── */
        <div className="space-y-4">
          {/* Volunteer Scoreboard Filters Panel */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-4 shadow-premium flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="w-4.5 h-4.5" />
              </span>
              <input
                type="text"
                placeholder="Search scoreboards by volunteer name or gate station..."
                value={perfSearch}
                onChange={(e) => setPerfSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-app-card-border hover:border-slate-350 dark:hover:border-slate-800 focus:border-primary focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium transition-all"
              />
            </div>

            {/* Performance Rating Filter Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-app-card-border rounded-xl px-3 py-1.5 w-full md:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Cohort rating:</span>
              <select
                value={perfRatingFilter}
                onChange={(e) => setPerfRatingFilter(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-app-text focus:outline-none border-none pr-6 cursor-pointer"
              >
                <option value="all">All Ratings</option>
                <option value="excellent">Excellent (90+ score)</option>
                <option value="good">Good (70-89 score)</option>
                <option value="needs_improvement">Needs Improvement (&lt;70)</option>
              </select>
            </div>
          </div>

          {/* Volunteer Scoreboard Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[30vh] bg-app-card border border-app-card-border rounded-2xl p-8">
              <div className="w-10 h-10 border-4 border-t-primary border-slate-200 dark:border-slate-800 rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-550 dark:text-slate-400 font-bold font-outfit">Compiling operator scoreboards...</p>
            </div>
          ) : filteredPerformances.length > 0 ? (
            <div className="bg-app-card border border-app-card-border rounded-2xl overflow-hidden shadow-premium">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs font-semibold">
                  <thead>
                    <tr className="border-b border-app-card-border bg-slate-50 dark:bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-4">Volunteer</th>
                      <th className="p-4">Assigned Gate</th>
                      <th className="p-4 text-center">Operator Score</th>
                      <th className="p-4 text-center">Checklists Submitted</th>
                      <th className="p-4 text-center">Redeployments Done</th>
                      <th className="p-4 text-center">Active Shift Hours</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-card-border/60">
                    {filteredPerformances.map(p => {
                      const score = p.stats.operator_score;
                      const isExcellent = score >= 90;
                      const isGood = score >= 70 && score < 90;

                      return (
                        <tr key={p.volunteer_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all">
                          {/* Name + email details */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-premium flex items-center justify-center text-white text-xs font-black shadow-sm flex-shrink-0">
                                {getInitials(p.volunteer_name)}
                              </div>
                              <div className="overflow-hidden">
                                <p className="font-extrabold text-app-text text-sm truncate max-w-[180px]" title={p.volunteer_name}>
                                  {p.volunteer_name}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold truncate max-w-[180px]">{p.email || 'No email registered'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Stationed gate */}
                          <td className="p-4 font-bold text-slate-500 dark:text-slate-450">
                            {p.gate_name}
                          </td>

                          {/* Dynamic operator score badge */}
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                              isExcellent 
                                ? 'bg-pink-500/10 border-pink-500/20 text-pink-400' 
                                : isGood 
                                ? 'bg-primary/10 border-primary/20 text-primary' 
                                : 'bg-danger/10 border-danger/20 text-danger'
                            }`}>
                              {score}/100
                            </span>
                          </td>

                          {/* Checklists submitted */}
                          <td className="p-4 text-center font-bold text-app-text">
                            {p.stats.checklists_submitted}
                          </td>

                          {/* Redeployments completed */}
                          <td className="p-4 text-center font-bold text-app-text">
                            {p.stats.assignments_completed}
                          </td>

                          {/* Total Active Hours */}
                          <td className="p-4 text-center font-mono font-bold text-app-text">
                            {p.stats.total_hours} hrs
                          </td>

                          {/* Current active status badge */}
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              p.status === 'Available' 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                : p.status === 'Busy' 
                                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                                : p.status === 'Break' 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-slate-800 border-slate-700 text-slate-450'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                p.status === 'Available' ? 'bg-green-500 animate-pulse' :
                                p.status === 'Busy' ? 'bg-red-500' :
                                p.status === 'Break' ? 'bg-amber-500' : 'bg-slate-500'
                              }`} />
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-app-card border border-app-card-border rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-premium">
              <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
              <h4 className="text-base font-bold text-app-text mb-1">No Performances Found</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                No volunteer scores match the active compliance cohort filter. Try resetting search parameters.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Daily Report Detailed modal overlay */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-app-card border border-app-card-border rounded-2xl overflow-hidden p-6 shadow-2xl space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-app-card-border/60 pb-3">
              <div>
                <h3 className="font-outfit text-lg font-black text-app-text">
                  Daily Work Report Detail
                </h3>
                <p className="text-[10px] text-slate-500 font-bold font-mono">
                  Report ID: #{selectedReport.report_id} · Filed at: {selectedReport.submitted_at}
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-app-card-border rounded-full hover:text-white transition-colors cursor-pointer text-slate-550 dark:text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Reporter metadata card */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-app-card-border">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide block">Volunteer Reporter</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-premium flex items-center justify-center text-white text-[9px] font-black shadow-sm">
                    {getInitials(selectedReport.volunteer_name)}
                  </div>
                  <span className="text-xs font-bold text-app-text truncate">{selectedReport.volunteer_name}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide block">Assigned Gate/Station</span>
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {selectedReport.gate_name}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-4.5 max-h-[50vh] overflow-y-auto pr-1">
              {/* 1. Tasks Completed */}
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 text-primary" /> Tasks Completed during Shift
                </span>
                <p className="text-xs font-semibold text-app-text leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-app-card-border/60 whitespace-pre-wrap">
                  {selectedReport.tasks}
                </p>
              </div>

              {/* 2. Crowd Situation */}
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-secondary" /> Crowd Flow / Situation Summary
                </span>
                <p className="text-xs font-semibold text-slate-550 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-app-card-border/60 whitespace-pre-wrap">
                  {selectedReport.crowd_situation}
                </p>
              </div>

              {/* 3. Issues Faced */}
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-danger" /> Issues Faced & Failures
                </span>
                <p className={`text-xs font-semibold leading-relaxed p-3 rounded-xl border whitespace-pre-wrap ${
                  (selectedReport.issues_faced || '').toLowerCase() !== 'none'
                    ? 'bg-danger/5 border-danger/15 text-danger font-bold'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-app-card-border/60 text-slate-500'
                }`}>
                  {selectedReport.issues_faced || 'None reported.'}
                </p>
              </div>

              {/* 4. Action Taken */}
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Actions Taken locally
                </span>
                <p className="text-xs font-semibold text-slate-550 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-app-card-border/60 whitespace-pre-wrap">
                  {selectedReport.action_taken || 'No local actions needed.'}
                </p>
              </div>

              {/* 5. Suggestions */}
              {selectedReport.suggestions && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Suggestions for Next Shifts
                  </span>
                  <p className="text-xs font-semibold text-slate-550 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-app-card-border/60 whitespace-pre-wrap">
                    {selectedReport.suggestions}
                  </p>
                </div>
              )}

              {/* 6. Additional Notes */}
              {selectedReport.additional_notes && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400" /> Additional Notes
                  </span>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-app-card-border/60 whitespace-pre-wrap">
                    {selectedReport.additional_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-app-card-border/60 flex justify-end gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-950 border border-app-card-border hover:bg-slate-200 dark:hover:bg-slate-900 transition-colors text-xs font-bold rounded-xl cursor-pointer text-app-text"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
