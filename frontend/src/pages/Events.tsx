import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  X, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Info
} from 'lucide-react';
import api from '../services/api';
import { Event } from '../types';

export const Events: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState(1000);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (err: any) {
      setError('Failed to fetch events from backend APIs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const clearForm = () => {
    setName('');
    setVenue('');
    setDate('');
    setCapacity(1000);
    setSelectedEventId(null);
  };

  const handleOpenCreateModal = () => {
    clearForm();
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event: Event) => {
    setName(event.event_name);
    setVenue(event.venue);
    setDate(event.date);
    setCapacity(event.capacity);
    setSelectedEventId(event.event_id);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim() || !venue.trim() || !date.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      if (modalMode === 'create') {
        const response = await api.post('/events', {
          event_name: name.trim(),
          venue: venue.trim(),
          date: date.trim(),
          capacity: Number(capacity)
        });
        setSuccessMsg(`Event "${name}" registered successfully.`);
      } else if (modalMode === 'edit' && selectedEventId !== null) {
        await api.put(`/events/${selectedEventId}`, {
          event_name: name.trim(),
          venue: venue.trim(),
          date: date.trim(),
          capacity: Number(capacity)
        });
        setSuccessMsg(`Event "${name}" details updated.`);
      }
      setIsModalOpen(false);
      clearForm();
      fetchEvents();
      
      // Auto clear success message
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save event.');
    }
  };

  const handleDeleteEvent = async (eventId: number, eventName: string) => {
    const isConfirmed = window.confirm(
      `WARNING: Removing "${eventName}" will permanently delete all associated gates, check-in histories, and rosters from the database.

Are you sure you want to proceed?`
    );

    if (!isConfirmed) return;

    setError(null);
    setSuccessMsg(null);
    try {
      await api.delete(`/events/${eventId}`);
      setSuccessMsg(`Event "${eventName}" canceled and deleted from system.`);
      fetchEvents();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete event.');
    }
  };

  const filteredEvents = events.filter(e => 
    e.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.venue.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Event Administration</h2>
          <p className="text-sm text-slate-400">View schedules, register new summit dates, or modify venue capacities.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-lg shadow-md shadow-primary/20 hover:shadow-primary/35 border border-primary/45 font-semibold text-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Register Event</span>
        </button>
      </div>

      {/* Message Notifications */}
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

      {/* Filter Toolbar */}
      <div className="flex items-center w-full max-w-md p-1 bg-slate-950/60 rounded-lg border border-slate-800">
        <span className="pl-3 text-slate-500"><Search className="w-4 h-4" /></span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by event name or venue location..."
          className="w-full pl-3 pr-4 py-2 text-xs bg-transparent border-none focus:outline-none text-slate-100 placeholder-slate-600 font-medium"
        />
      </div>

      {/* Events List Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500">Retrieving registers...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-850 rounded-xl bg-slate-900/10">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="font-outfit text-sm font-semibold text-slate-400">No Events Found</h4>
          <p className="text-xs text-slate-600 mt-1">Check back later or register a new event to populate the grid.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => (
            <div 
              key={evt.event_id} 
              className="p-6 rounded-xl border border-slate-850 bg-slate-900 hover:border-slate-800 transition-all flex flex-col group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="p-2 border border-primary/20 bg-primary/5 text-primary rounded-lg">
                  <Calendar className="w-5 h-5" />
                </span>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenEditModal(evt)}
                    className="p-1.5 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-md transition-all"
                    title="Edit Details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteEvent(evt.event_id, evt.event_name)}
                    className="p-1.5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 rounded-md transition-all"
                    title="Delete Event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="font-outfit text-base font-bold text-slate-100 mb-3 group-hover:text-primary transition-colors">{evt.event_name}</h3>
              
              <div className="space-y-2 text-xs font-semibold text-slate-400 mt-auto pt-4 border-t border-slate-850">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{evt.venue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{evt.date}</span>
                  </span>
                  <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-300 font-mono">
                    <Users className="w-3 h-3 text-slate-500" />
                    <span>CAP: {evt.capacity}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRUD Edit/Create Modal dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-outfit text-lg font-bold text-slate-100 mb-6">
              {modalMode === 'create' ? 'Register New Event' : 'Modify Event Details'}
            </h3>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Event Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Annual AI &amp; Security Summit"
                  className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Venue Location</label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Auditorium C, Grand Expo Center"
                  className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Max Safety Capacity</label>
                  <input
                    type="number"
                    required
                    min={10}
                    max={200000}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-slate-950/60 focus:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium font-mono"
                  />
                </div>
              </div>

              {modalMode === 'create' && (
                <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-850 flex gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    Note: Registering a new event automatically creates three default entrance foyer gates: North Gate Foyer, South Exit-Foyer, and VIP Entry.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 mt-6 text-sm font-semibold text-white bg-primary hover:bg-blue-750 border border-primary/45 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center"
              >
                <span>{modalMode === 'create' ? 'Register Schedule' : 'Commit Changes'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Events;