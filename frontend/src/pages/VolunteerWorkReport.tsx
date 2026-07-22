import React, { useState, useEffect } from 'react';
import { 
  FileText, Clipboard, AlertTriangle, Lightbulb, 
  Send, RefreshCw, CheckCircle, HelpCircle
} from 'lucide-react';
import api from '../services/api';

export const VolunteerWorkReport: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields
  const [tasks, setTasks] = useState('');
  const [crowdSituation, setCrowdSituation] = useState('Normal');
  const [issuesFaced, setIssuesFaced] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const checkSubmission = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/volunteers/work-report');
      if (response.data.submitted) {
        setSubmitted(true);
        setReport(response.data.report);
      } else {
        setSubmitted(false);
        setReport(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to check report submission status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubmission();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!tasks.trim() || !issuesFaced.trim() || !actionTaken.trim()) {
      setError('Tasks completed, issues faced, and action taken are required.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/volunteers/work-report', {
        tasks: tasks.trim(),
        crowd_situation: crowdSituation,
        issues_faced: issuesFaced.trim(),
        action_taken: actionTaken.trim(),
        suggestions: suggestions.trim() || null,
        additional_notes: additionalNotes.trim() || null
      });
      setSuccess('Your daily work report has been successfully filed and logged.');
      await checkSubmission();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit daily work report.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium font-outfit">Syncing work report files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Daily Shift Report</h2>
        <p className="text-sm text-slate-400">Log your daily operational updates, crowd status, and suggestions before checking out.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/25 text-success text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {submitted ? (
        /* Report View Mode */
        <div className="p-6 rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 space-y-6">
          <div className="flex items-center justify-between border-b border-app-card-border/60 pb-4">
            <div>
              <span className="text-[10px] text-slate-550 font-extrabold uppercase tracking-widest block mb-1">Today's Report Status</span>
              <h3 className="text-lg font-black text-emerald-400 font-outfit flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Submitted &amp; Filed
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono font-semibold">
              Filed: {report?.submitted_at ? new Date(report.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/40 border border-app-card-border">
              <span className="text-[9px] font-extrabold uppercase text-slate-550 tracking-wider">Crowd Situation</span>
              <p className={`text-sm font-black mt-1 ${
                report?.crowd_situation === 'Critical' ? 'text-red-400' :
                report?.crowd_situation === 'Heavily Congested' ? 'text-orange-400' :
                report?.crowd_situation === 'Slightly Congested' ? 'text-amber-400' :
                'text-emerald-400'
              }`}>{report?.crowd_situation}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/40 border border-app-card-border">
              <span className="text-[9px] font-extrabold uppercase text-slate-550 tracking-wider">Date Logged</span>
              <p className="text-sm font-bold text-slate-300 mt-1">{new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-app-card-border/60">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Clipboard className="w-3.5 h-3.5 text-primary" /> Tasks Performed Today
              </h4>
              <p className="text-xs text-slate-300 bg-slate-950/30 p-3 rounded-lg border border-slate-900 leading-relaxed font-semibold whitespace-pre-wrap">{report?.tasks}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Operational Issues Faced
              </h4>
              <p className="text-xs text-slate-300 bg-slate-950/30 p-3 rounded-lg border border-slate-900 leading-relaxed font-semibold whitespace-pre-wrap">{report?.issues_faced}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Actions Protocol Taken
              </h4>
              <p className="text-xs text-slate-300 bg-slate-950/30 p-3 rounded-lg border border-slate-900 leading-relaxed font-semibold whitespace-pre-wrap">{report?.action_taken}</p>
            </div>

            {report?.suggestions && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Suggestions &amp; Improvements
                </h4>
                <p className="text-xs text-slate-300 bg-slate-950/30 p-3 rounded-lg border border-slate-900 leading-relaxed font-semibold whitespace-pre-wrap">{report?.suggestions}</p>
              </div>
            )}

            {report?.additional_notes && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Additional Notes
                </h4>
                <p className="text-xs text-slate-300 bg-slate-950/30 p-3 rounded-lg border border-slate-900 leading-relaxed font-semibold whitespace-pre-wrap">{report?.additional_notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Report Edit/Submission Mode */
        <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-app-card border border-app-card-border shadow-depth-1 space-y-5">
          <h3 className="font-outfit text-base font-black text-app-text flex items-center gap-2 border-b border-app-card-border/60 pb-3 mb-2">
            <FileText className="w-4 h-4 text-primary" />
            File Shift Work Report
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Tasks Completed Today *</label>
            <textarea
              required
              rows={4}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              placeholder="Detail your operational duties, e.g. assisted in ticket scanning, managed queue pipelines, etc..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-xs font-semibold text-slate-300 leading-relaxed resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Crowd Situation *</label>
              <select
                value={crowdSituation}
                onChange={(e) => setCrowdSituation(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-xs font-bold text-slate-300"
              >
                <option value="Normal">🟢 Normal (Smooth flow)</option>
                <option value="Slightly Congested">🟡 Slightly Congested</option>
                <option value="Heavily Congested">🟠 Heavily Congested</option>
                <option value="Critical">🔴 Critical (Dangerous bottlenecks)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Issues Faced *</label>
            <textarea
              required
              rows={3}
              value={issuesFaced}
              onChange={(e) => setIssuesFaced(e.target.value)}
              placeholder="Any congestion, malfunctions, rowdy behavior, or safety hazards? E.g., Barricade got knocked over, QR scanner lagged..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-xs font-semibold text-slate-300 leading-relaxed resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Action Taken *</label>
            <textarea
              required
              rows={3}
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="What actions did you execute to resolve the issues faced? E.g., re-aligned barricades, logged ticket manually, coordinated with security..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-xs font-semibold text-slate-300 leading-relaxed resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Suggestions for Next Shift (Optional)</label>
            <textarea
              rows={2}
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              placeholder="Add suggestions to improve crowd management metrics..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-xs font-semibold text-slate-300 leading-relaxed resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-450 uppercase tracking-wider mb-2">Additional Notes / Remarks (Optional)</label>
            <textarea
              rows={2}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any remaining shift details or notes..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-xs font-semibold text-slate-300 leading-relaxed resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-primary hover:bg-blue-600 text-xs font-bold text-white rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>Submit Roster Report</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default VolunteerWorkReport;
