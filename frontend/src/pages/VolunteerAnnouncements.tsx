import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Bell, 
  BellRing,
  AlertCircle, 
  Check, 
  CheckCheck,
  Calendar,
  Filter,
  Sparkles,
  Info
} from 'lucide-react';
import api from '../services/api';
import { Announcement } from '../types';

export const VolunteerAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterRead, setFilterRead] = useState<string>('All');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/announcements');
      setAnnouncements(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to fetch bulletins from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleAcknowledge = async (id: number) => {
    try {
      setError(null);
      await api.post(`/announcements/${id}/acknowledge`);
      // Update local state instead of full reload
      setAnnouncements(prev => prev.map(ann => 
        ann.announcement_id === id ? { ...ann, is_read: true } : ann
      ));
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Acknowledge failed. Please try again.');
    }
  };

  const filteredAnnouncements = announcements.filter(ann => {
    const matchesPriority = filterPriority === 'All' || ann.priority === filterPriority;
    const matchesRead = filterRead === 'All' || 
                        (filterRead === 'Unread' && !ann.is_read) || 
                        (filterRead === 'Read' && ann.is_read);
    return matchesPriority && matchesRead;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium font-outfit">Loading bulletins feeds...</p>
      </div>
    );
  }

  const unreadCount = announcements.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Administrative Announcements</h2>
          <p className="text-sm text-slate-400 font-medium">Keep track of priority bulletins, weather notices, and safety guidelines broadcasted by admins.</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/15 border border-warning/30 text-warning text-xs font-bold animate-pulse-slow self-start sm:self-auto">
            <BellRing className="w-4 h-4" />
            <span>{unreadCount} Unread Bulletins</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Filter Feeds:</span>
        </div>

        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <span>Priority:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-primary font-medium"
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span>Read Status:</span>
            <select
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-primary font-medium"
            >
              <option value="All">All Bulletins</option>
              <option value="Unread">Unread Bulletins</option>
              <option value="Read">Acknowledged Bulletins</option>
            </select>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.length > 0 ? (
          filteredAnnouncements.map((ann) => {
            const isHigh = ann.priority === 'High';
            const isMed = ann.priority === 'Medium';
            const isUnread = !ann.is_read;

            return (
              <div 
                key={ann.announcement_id} 
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  isUnread 
                    ? 'bg-slate-900/60 border-slate-700/80 shadow-md ring-1 ring-slate-800' 
                    : 'bg-slate-900/20 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3.5">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase border ${
                        isHigh 
                          ? 'bg-danger/15 border-danger/30 text-danger' 
                          : isMed 
                          ? 'bg-warning/15 border-warning/30 text-warning' 
                          : 'bg-success/15 border-success/30 text-success'
                      }`}>
                        {ann.priority} Priority
                      </span>
                      
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    
                    <h3 className={`text-base font-bold ${isUnread ? 'text-slate-100' : 'text-slate-300'}`}>
                      {ann.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3.5 text-xs text-slate-500 font-semibold self-start sm:self-auto">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      {ann.created_at ? new Date(ann.created_at).toLocaleString() : 'Recent'}
                    </span>
                  </div>
                </div>

                <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-4 whitespace-pre-wrap">
                  {ann.message}
                </p>

                <div className="flex items-center justify-between border-t border-slate-800/40 pt-4">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Acknowledge reading to clean alert inbox
                  </span>
                  
                  {isUnread ? (
                    <button
                      onClick={() => handleAcknowledge(ann.announcement_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-blue-750 rounded-lg shadow border border-primary/40 focus:outline-none transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-success text-xs font-bold px-2 py-1 bg-success/10 rounded border border-success/20">
                      <CheckCheck className="w-4 h-4" />
                      <span>Acknowledged</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 rounded-2xl bg-slate-900/30 border border-slate-800/80 text-center flex flex-col items-center justify-center">
            <Megaphone className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-100 mb-2 font-outfit">No Bulletins Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">No announcements matching selected filters are currently active in the database.</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default VolunteerAnnouncements;