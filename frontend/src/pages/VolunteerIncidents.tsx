import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Send, 
  MapPin, 
  FileText,
  AlertCircle,
  CheckCircle,
  Camera,
  Layers,
  Calendar,
  User,
  Sparkles,
  Info
} from 'lucide-react';
import api, { getApiBaseUrl } from '../services/api';
import { Incident } from '../types';

export const VolunteerIncidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentType, setIncidentType] = useState('Crowd Congestion');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

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

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/incidents');
      setIncidents(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load incident history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAttachMockPhoto = () => {
    // Selects a random realistic emergency/security mock photo from unsplash
    const mockPhotos = [
      'https://images.unsplash.com/photo-1599740831119-070df44a7fbf?auto=format&fit=crop&w=600&q=80', // barricade
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80', // conference hall queue
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80', // crowded arena
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80'  // server tech room
    ];
    const randomPhoto = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
    setPhotoUrl(randomPhoto);
    setSuccess('Mock device photo captured and attached.');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim() || !description.trim()) {
      setError('Please specify both the location and detailed description of the incident.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await api.post('/incidents', {
        incident_type: incidentType,
        location: location.trim(),
        severity,
        description: description.trim(),
        photo_url: photoUrl
      });

      setSuccess('Incident reported successfully. Emergency Dispatch notified.');
      setIncidentType('Crowd Congestion');
      setLocation('');
      setSeverity('Medium');
      setDescription('');
      setPhotoUrl(null);
      
      // Refresh list
      await fetchIncidents();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to file incident report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-t-primary border-slate-800 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium font-outfit">Loading dispatch log files...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="font-outfit text-3xl font-extrabold text-slate-100 tracking-tight">Incident Reporting & Dispatch</h2>
        <p className="text-sm text-slate-400">File immediate security warnings, medical emergencies, or congestion bottlenecks directly to the command panel.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 animate-bounce" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Columns (3): Report Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">New Incident Form</span>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Incident Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-slate-300 focus:outline-none font-medium"
              >
                <option value="Crowd Congestion">Crowd Congestion</option>
                <option value="Scanner Failure">Scanner Failure</option>
                <option value="Medical Emergency">Medical Emergency</option>
                <option value="Barrier Breach">Barrier Breach</option>
                <option value="Lost Property / Person">Lost Property / Person</option>
                <option value="Security Anomaly">Security Anomaly</option>
                <option value="Other Issue">Other Issue</option>
              </select>
            </div>

            {/* Severity Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Severity Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-slate-300 focus:outline-none font-medium"
              >
                <option value="Low">Low (Informative)</option>
                <option value="Medium">Medium (Attention required)</option>
                <option value="High">High (Immediate response)</option>
                <option value="Critical">Critical (Action required)</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Location / Station</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <MapPin className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Queue Line B - main foyer entrance"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Description Details</label>
            <div className="relative">
              <span className="absolute top-3.5 left-3.5 text-slate-500">
                <FileText className="w-4 h-4" />
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what occurred, who is involved, and what actions are being taken..."
                rows={4}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 focus:border-primary focus:outline-none rounded-lg text-slate-300 font-medium resize-none"
              />
            </div>
          </div>

          {/* Device Camera Simulated Upload */}
          <div className="border-t border-slate-800/60 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAttachMockPhoto}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-all focus:outline-none"
              >
                <Camera className="w-4.5 h-4.5 text-slate-400" />
                <span>Simulate Camera Photo</span>
              </button>
              
              {photoUrl && (
                <span className="text-xs text-slate-500 font-mono truncate max-w-[150px]">Attached</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-danger hover:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg shadow-lg border border-danger/45 focus:outline-none transition-all w-full sm:w-auto justify-center"
            >
              <Send className="w-4.5 h-4.5" />
              <span>{submitting ? 'Notifying Dispatch...' : 'Dispatch Emergency Warning'}</span>
            </button>
          </div>

          {photoUrl && (
            <div className="mt-4 p-2 bg-slate-950 rounded-lg border border-slate-800 w-full flex items-center justify-center">
              <img src={photoUrl} alt="Incident attachment preview" className="max-h-36 rounded border border-slate-800" />
            </div>
          )}
        </form>

        {/* Right Columns (2): Incident History */}
        <div className="lg:col-span-2 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Reported Dispatches (Live feed)</span>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {incidents.length > 0 ? (
              incidents.map((inc) => {
                const isCrit = inc.severity === 'Critical';
                const isHigh = inc.severity === 'High';
                const isMed = inc.severity === 'Medium';

                return (
                  <div key={inc.incident_id} className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/80 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase border ${
                            isCrit 
                              ? 'bg-danger/25 border-danger/40 text-danger animate-pulse' 
                              : isHigh 
                              ? 'bg-danger/15 border-danger/30 text-danger' 
                              : isMed 
                              ? 'bg-warning/15 border-warning/30 text-warning' 
                              : 'bg-success/15 border-success/30 text-success'
                          }`}>
                            {inc.severity} Severity
                          </span>
                          {inc.is_resolved ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase border bg-green-500/10 border-green-500/35 text-green-400">
                              Resolved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase border bg-slate-800 border-slate-700 text-slate-400 animate-pulse">
                              Active
                            </span>
                          )}
                        </div>
                        
                        <h4 className="font-bold text-sm text-slate-100 mt-2">{inc.incident_type}</h4>
                      </div>

                      <span className="text-[10px] text-slate-500 font-semibold font-mono whitespace-nowrap">
                        {inc.created_at ? new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-semibold text-slate-400">
                      <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-500" /> {inc.location}</p>
                      <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Reported by: {inc.volunteer_name}</p>
                    </div>

                    <p className="text-xs text-slate-500 font-semibold leading-relaxed whitespace-pre-wrap">{inc.description}</p>
                    
                    {inc.photo_url ? (
                      <div className="flex items-center gap-3 mt-2">
                        <img 
                          src={getPhotoUrl(inc.photo_url)} 
                          alt="Attached incident snapshot" 
                          className="w-20 h-20 object-cover rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer" 
                          onClick={() => setEnlargedImage(getPhotoUrl(inc.photo_url))}
                          title="Click to enlarge"
                        />
                        <div className="flex flex-col gap-1 text-[10px] font-bold">
                          <button
                            onClick={() => setEnlargedImage(getPhotoUrl(inc.photo_url))}
                            className="text-blue-400 hover:text-blue-300 font-bold text-left transition-colors cursor-pointer"
                          >
                            🔍 Click to enlarge
                          </button>
                          <a 
                            href={getPhotoUrl(inc.photo_url)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-slate-450 hover:text-slate-350 transition-colors"
                          >
                            ↗ Open in new tab
                          </a>
                          <button 
                            onClick={() => handleDownloadImage(inc.photo_url!)}
                            className="text-slate-450 hover:text-slate-350 text-left transition-colors cursor-pointer"
                          >
                            ⬇ Download image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 py-1.5 px-3 bg-slate-950/40 rounded border border-dashed border-slate-800 text-[10px] text-slate-500 font-bold w-max">
                        📷 No Photo
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 rounded-xl bg-slate-900/10 border border-slate-800/50 text-center flex flex-col items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-slate-600 mb-3" />
                <h4 className="text-sm font-bold text-slate-100 mb-1">No Dispatches Logged</h4>
                <p className="text-xs text-slate-500 max-w-xs">No emergency reports have been filed from the field today.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {enlargedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-4xl max-h-[85vh] bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden p-3 shadow-2xl flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full transition-colors font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            <img src={enlargedImage} alt="Enlarged view" className="max-w-full max-h-[70vh] object-contain rounded-lg border border-slate-800" />
            <div className="mt-4 flex justify-between gap-4 w-full px-2 text-xs">
              <a 
                href={enlargedImage} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors font-bold"
              >
                ↗ Open in New Tab
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
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-slate-950 rounded-lg transition-colors font-bold cursor-pointer"
              >
                ⬇ Download Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default VolunteerIncidents;