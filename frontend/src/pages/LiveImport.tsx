import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Download, Users, QrCode, CheckCircle, XCircle,
  AlertTriangle, Search, Filter, RefreshCw, FileText,
  ChevronLeft, ChevronRight, Eye, Shield, BarChart3,
  Clock, MapPin, Ticket, ArrowDownToLine, Info
} from 'lucide-react';
import api from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  failed: number;
  total_rows: number;
  errors: string[];
  event_id: number;
  attendees: ImportedAttendee[];
  import_type: string;
}

interface ImportedAttendee {
  attendee_id: number;
  attendee_name: string;
  email: string | null;
  phone: string | null;
  ticket_id: string;
  ticket_type: string;
  ticket_status: string;
  assigned_gate: number;
  gate_name: string;
  is_checked_in: boolean;
  entry_time: string | null;
  qr_code: string;
  qr_image_available: boolean;
  qr_image_path: string | null;
  import_source: string;
  imported_at: string;
}

interface AttendeeListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  attendees: ImportedAttendee[];
}

interface ScanLog {
  log_id: number;
  scan_time: string;
  scan_result: string;
  scan_source: string;
  attendee_id: number | null;
  attendee_name: string;
  ticket_id: string | null;
  ticket_type: string | null;
  gate_id: number;
  gate_name: string;
  volunteer_id: number | null;
  volunteer_name: string;
  notes: string | null;
}

interface ScanLogResponse {
  total: number;
  page: number;
  total_pages: number;
  summary: Record<string, number>;
  logs: ScanLog[];
}

interface LiveStats {
  total_imported: number;
  total_checked_in: number;
  pending_entry: number;
  check_in_rate: number;
  total_scan_attempts: number;
  scan_results: Record<string, number>;
  scan_success_rate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
  ALLOWED:        { label: 'Allowed',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
  ALREADY_SCANNED:{ label: 'Duplicate',      color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   icon: AlertTriangle },
  WRONG_GATE:     { label: 'Wrong Gate',     color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30', icon: MapPin },
  EXPIRED_TICKET: { label: 'Expired',        color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',       icon: XCircle },
  INVALID_QR:     { label: 'Invalid QR',     color: 'text-red-500',     bg: 'bg-red-600/10 border-red-600/30',       icon: XCircle },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const LiveImport: React.FC = () => {
  const [systemMode, setSystemMode] = useState<'Demo' | 'Live' | 'loading'>('loading');
  const [activeTab, setActiveTab] = useState<'import' | 'attendees' | 'scanlogs' | 'validate'>('import');

  // Import state
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attendees state
  const [attendees, setAttendees] = useState<AttendeeListResponse | null>(null);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesPage, setAttendeesPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGate, setFilterGate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCheckedIn, setFilterCheckedIn] = useState('');

  // Scan logs state
  const [scanLogs, setScanLogs] = useState<ScanLogResponse | null>(null);
  const [scanLogsLoading, setScanLogsLoading] = useState(false);
  const [scanLogsPage, setScanLogsPage] = useState(1);
  const [scanResultFilter, setScanResultFilter] = useState('');

  // Stats state
  const [stats, setStats] = useState<LiveStats | null>(null);

  // Manual validate state
  const [validateQR, setValidateQR] = useState('');
  const [validateGate, setValidateGate] = useState('');
  const [validateResult, setValidateResult] = useState<any | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);

  // Fetch system mode
  useEffect(() => {
    api.get('/system/mode')
      .then(res => setSystemMode(res.data.system_mode || 'Demo'))
      .catch(() => setSystemMode('Demo'));
  }, []);

  // Fetch stats when in Live Mode
  useEffect(() => {
    if (systemMode === 'Live') {
      fetchStats();
    }
  }, [systemMode]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/live/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Stats fetch failed', e);
    }
  };

  const fetchAttendees = useCallback(async () => {
    if (systemMode !== 'Live') return;
    setAttendeesLoading(true);
    try {
      const params: Record<string, any> = { page: attendeesPage, page_size: 50 };
      if (searchQuery) params.search = searchQuery;
      if (filterGate) params.gate_id = parseInt(filterGate);
      if (filterStatus) params.ticket_status = filterStatus;
      if (filterCheckedIn !== '') params.checked_in = filterCheckedIn === 'true';
      const res = await api.get('/live/attendees', { params });
      setAttendees(res.data);
    } catch (e) {
      console.error('Attendees fetch failed', e);
    } finally {
      setAttendeesLoading(false);
    }
  }, [systemMode, attendeesPage, searchQuery, filterGate, filterStatus, filterCheckedIn]);

  const fetchScanLogs = useCallback(async () => {
    if (systemMode !== 'Live') return;
    setScanLogsLoading(true);
    try {
      const params: Record<string, any> = { page: scanLogsPage, page_size: 100 };
      if (scanResultFilter) params.result = scanResultFilter;
      const res = await api.get('/live/scan-logs', { params });
      setScanLogs(res.data);
    } catch (e) {
      console.error('Scan logs fetch failed', e);
    } finally {
      setScanLogsLoading(false);
    }
  }, [systemMode, scanLogsPage, scanResultFilter]);

  useEffect(() => { if (activeTab === 'attendees') fetchAttendees(); }, [activeTab, fetchAttendees]);
  useEffect(() => { if (activeTab === 'scanlogs') fetchScanLogs(); }, [activeTab, fetchScanLogs]);

  // ─── File Upload ────────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setImportError('Only CSV (.csv) and Excel (.xlsx, .xls) files are supported.');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    const endpoint = ext === 'csv' ? '/live/import/csv' : '/live/import/excel';

    try {
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      fetchStats();
    } catch (err: any) {
      setImportError(
        err?.response?.data?.detail || 'Import failed. Please check the file format and try again.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/live/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crowdshield_import_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Template download failed', e);
    }
  };

  const handleDownloadQR = async (attendeeId: number, name: string) => {
    try {
      const res = await api.get(`/live/attendees/${attendeeId}/qr`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${name.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('QR image not found. This attendee may not have a generated QR yet.');
    }
  };

  const handleManualValidate = async () => {
    if (!validateQR.trim() || !validateGate.trim()) return;
    setValidateLoading(true);
    setValidateResult(null);
    try {
      const res = await api.post('/live/qr/validate', {
        qr_token: validateQR.trim(),
        gate_id: parseInt(validateGate),
        scan_source: 'manual',
      });
      setValidateResult(res.data);
      fetchStats();
      if (activeTab === 'scanlogs') fetchScanLogs();
    } catch (err: any) {
      setValidateResult({ result: 'ERROR', message: err?.response?.data?.detail || 'Validation request failed.' });
    } finally {
      setValidateLoading(false);
    }
  };

  // ─── Demo Mode Guard ────────────────────────────────────────────────────────

  if (systemMode === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (systemMode !== 'Live') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center">
          <Shield className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-app-text mb-2">Live Mode Required</h2>
          <p className="text-slate-400 mb-4">
            The QR Import System is only available in <strong>Live Mode</strong>.<br />
            Your system is currently running in <strong>Demo Mode</strong>.
          </p>
          <p className="text-sm text-slate-500">
            To enable Live Mode, go to <strong>Settings → System Operating Mode</strong> and switch to Live.
          </p>
        </div>
      </div>
    );
  }

  // ─── Live Mode UI ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Live Mode Active</span>
          </div>
          <h1 className="text-2xl font-black text-app-text">Live QR Import System</h1>
          <p className="text-slate-400 text-sm mt-1">
            Import attendees from third-party platforms · Generate secure QR passes · Monitor real-time entry
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 hover:text-app-text border border-app-card-border rounded-xl hover:bg-app-card transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Imported',   value: stats.total_imported,       icon: Users,      color: 'text-blue-400' },
            { label: 'Checked In',       value: stats.total_checked_in,     icon: CheckCircle,color: 'text-emerald-400' },
            { label: 'Pending Entry',    value: stats.pending_entry,        icon: Clock,      color: 'text-amber-400' },
            { label: 'Scan Success Rate',value: `${stats.scan_success_rate}%`, icon: QrCode, color: 'text-purple-400' },
          ].map((s) => (
            <div key={s.label} className="bg-app-card border border-app-card-border rounded-2xl p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-app-bg">
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-lg font-black text-app-text">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-app-card border border-app-card-border rounded-2xl w-fit">
        {[
          { id: 'import',    label: 'Import',      icon: Upload },
          { id: 'attendees', label: 'Attendees',   icon: Users },
          { id: 'scanlogs',  label: 'Scan Logs',   icon: QrCode },
          { id: 'validate',  label: 'Manual Validate', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-app-text hover:bg-app-bg'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Import ─────────────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Upload Panel */}
          <div className="space-y-4">
            <div className="bg-app-card border border-app-card-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-violet-500/10">
                  <Upload className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-bold text-app-text text-sm">Import Attendees</h3>
                  <p className="text-xs text-slate-400">CSV or Excel from BookMyShow, Eventbrite, or any platform</p>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-violet-400 bg-violet-500/10 scale-[1.02]'
                    : importing
                    ? 'border-blue-400 bg-blue-500/5'
                    : 'border-app-card-border hover:border-violet-400/50 hover:bg-violet-500/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />

                {importing ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-violet-400">Importing &amp; generating QR codes…</p>
                    <p className="text-xs text-slate-500">This may take a moment for large files</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`p-4 rounded-2xl ${isDragging ? 'bg-violet-500/20' : 'bg-app-bg'}`}>
                      <Upload className={`w-8 h-8 ${isDragging ? 'text-violet-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-app-text text-sm">
                        {isDragging ? 'Drop to import' : 'Drag & drop your file here'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse — CSV, XLSX, XLS supported</p>
                    </div>
                  </div>
                )}
              </div>

              {importError && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{importError}</p>
                </div>
              )}

              {/* Template Download */}
              <div className="mt-4 p-4 bg-app-bg border border-app-card-border rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-app-text">CSV Template</p>
                    <p className="text-xs text-slate-500">Download the import template</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-all"
                >
                  <Download className="w-3 h-3" /> Template
                </button>
              </div>
            </div>

            {/* Column guide */}
            <div className="bg-app-card border border-app-card-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold text-app-text uppercase tracking-wider">Expected Columns</h4>
              </div>
              <div className="space-y-2">
                {[
                  { col: 'attendee_name', req: true, desc: 'Full name of the attendee' },
                  { col: 'ticket_id',     req: true, desc: 'Unique ticket / booking ID' },
                  { col: 'assigned_gate', req: true, desc: 'Gate number or gate name' },
                  { col: 'email',         req: false, desc: 'Email address' },
                  { col: 'phone',         req: false, desc: 'Phone / mobile number' },
                  { col: 'ticket_type',   req: false, desc: 'VIP, General, Student etc.' },
                  { col: 'ticket_status', req: false, desc: 'Active / Cancelled / Expired' },
                  { col: 'external_attendee_id', req: false, desc: 'Reference ID from source platform' },
                ].map((c) => (
                  <div key={c.col} className="flex items-center gap-3 text-xs">
                    <code className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] min-w-[140px]">
                      {c.col}
                    </code>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.req ? 'text-red-400 bg-red-500/10' : 'text-slate-500 bg-slate-800'}`}>
                      {c.req ? 'Required' : 'Optional'}
                    </span>
                    <span className="text-slate-400">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Import Result Panel */}
          <div className="bg-app-card border border-app-card-border rounded-2xl p-6">
            {!importResult ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="p-4 rounded-2xl bg-app-bg mb-4">
                  <BarChart3 className="w-8 h-8 text-slate-600" />
                </div>
                <p className="font-bold text-slate-500 text-sm">Import Result</p>
                <p className="text-xs text-slate-600 mt-1">Upload a file to see results here</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-app-card-border">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-app-text">Import Complete</h3>
                  <span className="ml-auto text-xs text-slate-500 uppercase bg-app-bg px-2 py-1 rounded-lg font-mono">
                    {importResult.import_type?.toUpperCase()}
                  </span>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Rows',  value: importResult.total_rows, color: 'text-blue-400' },
                    { label: 'Imported',    value: importResult.imported,   color: 'text-emerald-400' },
                    { label: 'Failed',      value: importResult.failed,     color: 'text-red-400' },
                  ].map((s) => (
                    <div key={s.label} className="bg-app-bg rounded-xl p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* QR Generation note */}
                <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center gap-3">
                  <QrCode className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <p className="text-xs text-violet-300">
                    QR codes generated for all {importResult.imported} imported attendees.
                    Switch to the <strong>Attendees</strong> tab to download individual QR passes.
                  </p>
                </div>

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {importResult.errors.length} row(s) had issues:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-slate-400 bg-app-bg px-3 py-1.5 rounded-lg">{e}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick preview */}
                {importResult.attendees.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">First 5 Imported</p>
                    <div className="space-y-1.5">
                      {importResult.attendees.slice(0, 5).map((a) => (
                        <div key={a.attendee_id} className="flex items-center gap-3 px-3 py-2 bg-app-bg rounded-xl">
                          <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-black text-violet-400">#{a.attendee_id}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-app-text truncate">{a.attendee_name}</p>
                            <p className="text-[10px] text-slate-500">{a.ticket_id} · {a.gate_name}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            a.ticket_type === 'VIP'
                              ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                              : 'text-slate-400 border-slate-600 bg-slate-800/50'
                          }`}>{a.ticket_type}</span>
                          {a.qr_image_available && (
                            <button
                              onClick={() => handleDownloadQR(a.attendee_id, a.attendee_name)}
                              className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title="Download QR"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Attendees ──────────────────────────────────────────────────── */}
      {activeTab === 'attendees' && (
        <div className="bg-app-card border border-app-card-border rounded-2xl overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-app-card-border flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-app-bg border border-app-card-border rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, ticket ID, email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-app-text placeholder-slate-500 outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-app-bg border border-app-card-border rounded-xl px-3 py-2 text-xs text-app-text outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Expired">Expired</option>
            </select>
            <select
              value={filterCheckedIn}
              onChange={(e) => setFilterCheckedIn(e.target.value)}
              className="bg-app-bg border border-app-card-border rounded-xl px-3 py-2 text-xs text-app-text outline-none"
            >
              <option value="">All Check-in</option>
              <option value="false">Not Checked In</option>
              <option value="true">Checked In</option>
            </select>
            <button
              onClick={() => { setAttendeesPage(1); fetchAttendees(); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all"
            >
              <Filter className="w-3 h-3" /> Apply
            </button>
          </div>

          {/* Table */}
          {attendeesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !attendees || attendees.attendees.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No imported attendees found.</p>
              <p className="text-xs text-slate-600 mt-1">Switch to the Import tab to upload your attendee list.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-app-card-border">
                      {['ID', 'Attendee', 'Ticket ID', 'Type', 'Gate', 'Status', 'Check-in', 'QR'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.attendees.map((a) => (
                      <tr key={a.attendee_id} className="border-b border-app-card-border/50 hover:bg-app-bg/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">#{a.attendee_id}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-app-text">{a.attendee_name}</p>
                          {a.email && <p className="text-[10px] text-slate-500">{a.email}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300 text-[10px]">{a.ticket_id}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border ${
                            a.ticket_type === 'VIP'
                              ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                              : 'text-slate-400 border-slate-600 bg-slate-800/50'
                          }`}>{a.ticket_type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{a.gate_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                            a.ticket_status === 'Active' ? 'text-emerald-400 bg-emerald-500/10' :
                            a.ticket_status === 'Cancelled' ? 'text-red-400 bg-red-500/10' :
                            'text-amber-400 bg-amber-500/10'
                          }`}>{a.ticket_status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {a.is_checked_in ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-bold text-[10px]">
                              <CheckCircle className="w-3 h-3" /> In
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.qr_image_available ? (
                            <button
                              onClick={() => handleDownloadQR(a.attendee_id, a.attendee_name)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-all"
                            >
                              <ArrowDownToLine className="w-3 h-3" /> QR
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {attendees.total_pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-app-card-border">
                  <p className="text-xs text-slate-400">
                    {attendees.total} attendees · Page {attendees.page} of {attendees.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={attendeesPage === 1}
                      onClick={() => setAttendeesPage(p => p - 1)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-app-text hover:bg-app-bg disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={attendeesPage >= attendees.total_pages}
                      onClick={() => setAttendeesPage(p => p + 1)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-app-text hover:bg-app-bg disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Scan Logs ──────────────────────────────────────────────────── */}
      {activeTab === 'scanlogs' && (
        <div className="space-y-4">
          {/* Scan result summary */}
          {scanLogs?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(RESULT_CONFIG).map(([key, cfg]) => {
                const count = scanLogs.summary[key] || 0;
                return (
                  <div key={key} className={`border rounded-xl p-3 ${cfg.bg}`}>
                    <p className={`text-lg font-black ${cfg.color}`}>{count}</p>
                    <p className="text-xs text-slate-400">{cfg.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-app-card border border-app-card-border rounded-2xl overflow-hidden">
            {/* Filter bar */}
            <div className="p-4 border-b border-app-card-border flex items-center gap-3 flex-wrap">
              <select
                value={scanResultFilter}
                onChange={(e) => setScanResultFilter(e.target.value)}
                className="bg-app-bg border border-app-card-border rounded-xl px-3 py-2 text-xs text-app-text outline-none"
              >
                <option value="">All Results</option>
                {Object.entries(RESULT_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button
                onClick={() => { setScanLogsPage(1); fetchScanLogs(); }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              <p className="text-xs text-slate-500 ml-auto">{scanLogs?.total ?? 0} total scan attempts</p>
            </div>

            {/* Log table */}
            {scanLogsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !scanLogs || scanLogs.logs.length === 0 ? (
              <div className="text-center py-16">
                <QrCode className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No scan logs yet.</p>
                <p className="text-xs text-slate-600 mt-1">Scan logs will appear here when QR codes are validated.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-app-card-border">
                        {['Time', 'Result', 'Attendee', 'Ticket', 'Gate', 'Volunteer', 'Source'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scanLogs.logs.map((log) => {
                        const rc = RESULT_CONFIG[log.scan_result] || { label: log.scan_result, color: 'text-slate-400', bg: '', icon: Info };
                        const Icon = rc.icon;
                        return (
                          <tr key={log.log_id} className="border-b border-app-card-border/50 hover:bg-app-bg/50 transition-colors">
                            <td className="px-4 py-3 text-[10px] text-slate-400 whitespace-nowrap">{log.scan_time}</td>
                            <td className="px-4 py-3">
                              <span className={`flex items-center gap-1 font-bold text-[10px] ${rc.color}`}>
                                <Icon className="w-3 h-3" /> {rc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-app-text">{log.attendee_name}</td>
                            <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{log.ticket_id || '—'}</td>
                            <td className="px-4 py-3 text-slate-300">{log.gate_name}</td>
                            <td className="px-4 py-3 text-slate-400">{log.volunteer_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[9px] font-mono">{log.scan_source}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {scanLogs.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-app-card-border">
                    <p className="text-xs text-slate-400">Page {scanLogs.page} of {scanLogs.total_pages}</p>
                    <div className="flex gap-2">
                      <button disabled={scanLogsPage === 1} onClick={() => setScanLogsPage(p => p - 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-app-text disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button disabled={scanLogsPage >= scanLogs.total_pages} onClick={() => setScanLogsPage(p => p + 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-app-text disabled:opacity-30">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Manual Validate ────────────────────────────────────────────── */}
      {activeTab === 'validate' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-app-card border border-app-card-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-violet-500/10">
                <Shield className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="font-bold text-app-text text-sm">Manual QR Validation</h3>
                <p className="text-xs text-slate-400">Test QR validation — paste the QR token content to check</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">QR Token Content</label>
                <textarea
                  value={validateQR}
                  onChange={(e) => setValidateQR(e.target.value)}
                  placeholder='{"v":1,"attendee_id":1,"ticket_id":"TKT-001","event_id":1,"assigned_gate":1,...}'
                  className="w-full h-28 bg-app-bg border border-app-card-border rounded-xl px-4 py-3 text-xs font-mono text-app-text placeholder-slate-600 outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Gate ID</label>
                <input
                  type="number"
                  value={validateGate}
                  onChange={(e) => setValidateGate(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full bg-app-bg border border-app-card-border rounded-xl px-4 py-3 text-xs text-app-text placeholder-slate-600 outline-none focus:border-violet-500"
                />
              </div>

              <button
                onClick={handleManualValidate}
                disabled={validateLoading || !validateQR.trim() || !validateGate.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {validateLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                Validate QR
              </button>
            </div>
          </div>

          {/* Validation Result */}
          {validateResult && (() => {
            const rc = RESULT_CONFIG[validateResult.result];
            const Icon = rc?.icon || Info;
            return (
              <div className={`border rounded-2xl p-6 ${rc?.bg || 'bg-app-card border-app-card-border'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <Icon className={`w-6 h-6 ${rc?.color || 'text-slate-400'}`} />
                  <div>
                    <p className={`font-black text-lg ${rc?.color || 'text-slate-400'}`}>{rc?.label || validateResult.result}</p>
                    <p className="text-sm text-slate-300">{validateResult.message}</p>
                  </div>
                </div>
                {validateResult.attendee && (
                  <div className="pt-4 border-t border-white/10 space-y-1.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attendee Details</p>
                    {Object.entries(validateResult.attendee).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
                      <div key={k} className="flex gap-3 text-xs">
                        <span className="text-slate-500 min-w-[120px] capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-slate-200 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default LiveImport;
