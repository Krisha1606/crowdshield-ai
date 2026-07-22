import React from 'react';

// Unified high-end SVG styles and keyframe animations for premium vector storytelling
const svgStyles = `
  @keyframes scan-line {
    0% { transform: translateY(-40px); opacity: 0.1; }
    50% { opacity: 1; }
    100% { transform: translateY(140px); opacity: 0.1; }
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.85); opacity: 0.9; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes dash-flow {
    to { stroke-dashoffset: -60; }
  }
  @keyframes float-particle {
    0%, 100% { transform: translateY(0) translateX(0); }
    50% { transform: translateY(-10px) translateX(5px); }
  }
  @keyframes radar-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .svg-scan { animation: scan-line 3.2s infinite ease-in-out; transform-origin: center; }
  .svg-pulse { animation: pulse-ring 2.8s infinite cubic-bezier(0.165, 0.84, 0.44, 1); transform-origin: center; }
  .svg-dash { stroke-dasharray: 8, 4; animation: dash-flow 3s linear infinite; }
  .svg-particle-1 { animation: float-particle 5s ease-in-out infinite; }
  .svg-particle-2 { animation: float-particle 6.5s ease-in-out infinite; }
  .svg-radar { animation: radar-rotate 8s linear infinite; transform-origin: 250px 185px; }
  .svg-widget { animation: bounce-slow 4.5s ease-in-out infinite; }
  .svg-widget-delayed { animation: bounce-slow 4.5s ease-in-out infinite; animation-delay: 2s; }
`;

// 1. Stadium/Venue Illustration (Task 2: Stadiums, Concerts, Events)
export const VenueIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="stadium-dome-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
        <stop offset="50%" stopColor="#2563EB" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.02" />
      </linearGradient>
      <linearGradient id="border-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="25%" stopColor="#EC4899" />
        <stop offset="50%" stopColor="#7C3AED" />
        <stop offset="75%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
      <radialGradient id="stage-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#EC4899" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
      </radialGradient>
    </defs>
    
    {/* Grid floor */}
    <g opacity="0.35">
      <path d="M10 130 L190 130 M20 135 L180 135 M30 140 L170 140 M40 145 L160 145" stroke="#64748B" strokeWidth="0.5" />
      <path d="M40 125 L10 145 M100 125 L100 145 M160 125 L190 145" stroke="#64748B" strokeWidth="0.5" />
    </g>

    {/* Stage Concert glow */}
    <ellipse cx="100" cy="85" rx="35" ry="12" fill="url(#stage-glow)" />

    {/* Stadium Outer Ring Structure */}
    <ellipse cx="100" cy="80" rx="80" ry="40" stroke="url(#border-grad)" strokeWidth="2.5" fill="url(#stadium-dome-grad)" />
    
    {/* Grandstands / Tiers (Isometric layers) */}
    <ellipse cx="100" cy="80" rx="66" ry="32" stroke="#7C3AED" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="4 2" />
    <ellipse cx="100" cy="80" rx="52" ry="24" stroke="#2563EB" strokeWidth="1" strokeOpacity="0.6" />
    
    {/* Center Arena Stage */}
    <ellipse cx="100" cy="85" rx="26" ry="12" fill="#0B0F19" stroke="#06B6D4" strokeWidth="1.5" />
    
    {/* Concert Spotlights */}
    <path d="M100 85 L60 25 M100 85 L85 20 M100 85 L115 20 M100 85 L140 25" stroke="#EC4899" strokeWidth="0.75" strokeOpacity="0.5" strokeDasharray="3 2" />

    {/* Event Crowd nodes (Glowing particles) */}
    <circle cx="100" cy="85" r="3" fill="#EC4899" />
    <circle cx="100" cy="85" r="7" stroke="#EC4899" strokeWidth="1.25" className="svg-pulse" />
    
    {/* Floating telemetry indicators */}
    <circle cx="55" cy="65" r="4" fill="#06B6D4" className="svg-particle-1" />
    <circle cx="145" cy="65" r="4" fill="#F97316" className="svg-particle-2" />
    <circle cx="115" cy="95" r="3.5" fill="#22C55E" className="svg-particle-1" />
  </svg>
);

// 2. Smart Gates Illustration (Task 2: Smart Gates, Crowd Flow)
export const SmartGateIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="scanner-laser" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
      </linearGradient>
      <linearGradient id="post-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="50%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
    </defs>
    
    {/* Floor base */}
    <path d="M20 135 L180 135" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

    {/* Lane lines */}
    <path d="M60 135 L40 155 M140 135 L160 155" stroke="#475569" strokeWidth="1" strokeDasharray="3 2" />
    
    {/* Scanning Field Grid */}
    <rect x="62" y="45" width="76" height="88" fill="url(#scanner-laser)" rx="2" />
    <line x1="62" y1="55" x2="138" y2="55" stroke="#06B6D4" strokeWidth="1.5" className="svg-scan" />
    <line x1="62" y1="80" x2="138" y2="80" stroke="#7C3AED" strokeWidth="0.75" strokeOpacity="0.4" />
    <line x1="62" y1="105" x2="138" y2="105" stroke="#2563EB" strokeWidth="0.75" strokeOpacity="0.4" />

    {/* Main Gate Posts (Isometric 3D Pillars) */}
    <rect x="42" y="35" width="20" height="98" rx="4" fill="url(#post-grad)" stroke="#475569" strokeWidth="1" />
    <rect x="138" y="35" width="20" height="98" rx="4" fill="url(#post-grad)" stroke="#475569" strokeWidth="1" />

    {/* Glowing Status Beacons */}
    <circle cx="52" cy="50" r="3.5" fill="#10B981" />
    <circle cx="52" cy="50" r="7.5" stroke="#10B981" strokeWidth="1.25" className="svg-pulse" />
    <circle cx="148" cy="50" r="3.5" fill="#10B981" />

    {/* Intelligent scanning pathway arrows */}
    <path d="M100 130 L100 65" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 4" className="svg-dash" />
    <path d="M95 75 L100 70 L105 75" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* Crowd movement nodes */}
    <circle cx="100" cy="115" r="4.5" fill="#EC4899" className="svg-particle-1" />
    <circle cx="85" cy="95" r="4.5" fill="#7C3AED" className="svg-particle-2" />
    <circle cx="115" cy="80" r="4.5" fill="#2563EB" className="svg-particle-1" />
  </svg>
);

// 3. Volunteers & Security Staff Illustration (Task 2: Security Staff, Volunteers)
export const VolunteersIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="vol-primary" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
      <linearGradient id="vol-secondary" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    
    {/* Roster mesh paths */}
    <path d="M45 95 L100 50 M155 95 L100 50 M45 95 L155 95" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="5 3" className="svg-dash" />
    
    {/* Supervisor Staff (Center Node) */}
    <circle cx="100" cy="50" r="15" fill="url(#vol-primary)" />
    <path d="M86 80 C86 67 92 65 100 65 C108 65 114 67 114 80" fill="#EC4899" />
    <circle cx="100" cy="50" r="23" stroke="#F97316" strokeWidth="1.5" className="svg-pulse" />
    
    {/* Security Patrol Node (Left) */}
    <circle cx="45" cy="95" r="11" fill="url(#vol-secondary)" />
    <path d="M35 117 C35 108 40 106 45 106 C50 106 55 108 55 117" fill="#2563EB" />
    
    {/* Volunteer Node (Right) */}
    <circle cx="155" cy="95" r="11" fill="#06B6D4" />
    <path d="M145 117 C145 108 150 106 155 106 C160 106 165 108 165 117" fill="#06B6D4" fillOpacity="0.8" />

    {/* Dispatch radio wave indicators */}
    <path d="M95 24 L100 19 L105 24" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="100" y1="19" x2="100" y2="30" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 4. AI Risk Forecasting (Task 2: AI Monitoring, Risk)
export const RiskMonitoringIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
      </linearGradient>
    </defs>
    
    {/* Radar Screen Boundary */}
    <rect x="0" y="0" width="200" height="160" fill="#0B0F19" />
    
    {/* Concentric rings */}
    <circle cx="100" cy="80" r="50" stroke="#334155" strokeWidth="0.75" strokeDasharray="3 2" />
    <circle cx="100" cy="80" r="32" stroke="#475569" strokeWidth="1" />
    <circle cx="100" cy="80" r="15" stroke="#7C3AED" strokeWidth="0.75" />

    {/* Crosshairs */}
    <line x1="100" y1="0" x2="100" y2="160" stroke="#334155" strokeWidth="0.75" />
    <line x1="0" y1="80" x2="200" y2="80" stroke="#334155" strokeWidth="0.75" />

    {/* Radar sweep sector */}
    <path d="M100 80 L135 45 A 50 50 0 0 0 100 30 Z" fill="url(#radar-sweep)" className="svg-radar" style={{ transformOrigin: '100px 80px' }} />

    {/* Danger hotspots (Red warning nodes) */}
    <circle cx="130" cy="55" r="5" fill="#EF4444" />
    <circle cx="130" cy="55" r="11" stroke="#EF4444" strokeWidth="1.5" className="svg-pulse" />

    {/* Warning hotspots (Orange caution nodes) */}
    <circle cx="65" cy="95" r="4.5" fill="#F97316" />
    
    {/* Safe node */}
    <circle cx="110" cy="115" r="4" fill="#10B981" />
  </svg>
);

// 5. Incident Response / Protection (Task 2: Incident Management)
export const IncidentManagementIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="shield-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="50%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="mesh-glow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.01" />
      </linearGradient>
    </defs>
    
    {/* Protection grid dome */}
    <path d="M40 120 C40 50 160 50 160 120 Z" fill="url(#mesh-glow)" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
    <path d="M65 120 C65 75 135 75 135 120 Z" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
    
    {/* Security Shield Motif */}
    <path d="M100 35 C125 35 142 45 142 68 C142 102 107 122 100 126 C93 122 58 102 58 68 C58 45 75 35 100 35 Z" fill="url(#shield-gradient)" fillOpacity="0.1" stroke="url(#shield-gradient)" strokeWidth="2.5" strokeLinejoin="round" />
    
    {/* Shield Nodes Grid */}
    <circle cx="100" cy="55" r="4.5" fill="#EC4899" />
    <circle cx="80" cy="80" r="4" fill="#7C3AED" />
    <circle cx="120" cy="80" r="4" fill="#2563EB" />
    <circle cx="100" cy="105" r="4.5" fill="#06B6D4" />
    
    <path d="M100 55 L80 80 L100 105 L120 80 Z" stroke="#E2E8F0" strokeWidth="1" strokeOpacity="0.4" />
    <line x1="100" y1="55" x2="100" y2="105" stroke="#E2E8F0" strokeWidth="1" strokeOpacity="0.4" />

    {/* Danger Pulse alert on Shield border */}
    <circle cx="120" cy="80" r="10" stroke="#EF4444" strokeWidth="1.5" className="svg-pulse" />
  </svg>
);

// 6. Live Analytics / Trend Charts
export const AnalyticsIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="chart-area-pink" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#EC4899" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="chart-area-cyan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
      </linearGradient>
    </defs>
    
    {/* Grid boundary */}
    <path d="M30 25 L30 135 L175 135" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="30" y1="100" x2="175" y2="100" stroke="#1E293B" strokeWidth="0.75" strokeDasharray="3 3" />
    <line x1="30" y1="65" x2="175" y2="65" stroke="#1E293B" strokeWidth="0.75" strokeDasharray="3 3" />
    <line x1="30" y1="30" x2="175" y2="30" stroke="#1E293B" strokeWidth="0.75" strokeDasharray="3 3" />

    {/* Area 1: Cyan Wait Times */}
    <path d="M30 135 Q 50 100, 70 110 T 110 65 T 150 45 T 175 60 L 175 135 Z" fill="url(#chart-area-cyan)" />
    <path d="M30 135 Q 50 100, 70 110 T 110 65 T 150 45 T 175 60" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" />

    {/* Area 2: Pink/Orange Occupancy */}
    <path d="M30 135 Q 45 110, 65 85 T 105 80 T 145 35 T 175 25 L 175 135 Z" fill="url(#chart-area-pink)" />
    <path d="M30 135 Q 45 110, 65 85 T 105 80 T 145 35 T 175 25" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" />

    {/* Active tooltip point indicator */}
    <circle cx="145" cy="35" r="4.5" fill="#EC4899" />
    <circle cx="145" cy="35" r="10" stroke="#EC4899" strokeWidth="1.5" className="svg-pulse" />
  </svg>
);

// 7. Queue Intelligence / Wait Time Forecasting (Task 2: Queue forecasting)
export const QueueIntelligenceIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{svgStyles}</style>
    <defs>
      <linearGradient id="queue-flow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
    
    {/* Isometric queue line track */}
    <path d="M25 125 C60 105 75 135 110 115 C130 100 120 75 155 55" stroke="#334155" strokeWidth="6" strokeLinecap="round" opacity="0.15" />
    <path d="M25 125 C60 105 75 135 110 115 C130 100 120 75 155 55" stroke="url(#queue-flow)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 4" className="svg-dash" />

    {/* Attendees standing in line (nodes) */}
    <circle cx="35" cy="120" r="4.5" fill="#F97316" />
    <circle cx="58" cy="115" r="4.5" fill="#EC4899" />
    <circle cx="82" cy="125" r="4.5" fill="#7C3AED" />
    <circle cx="106" cy="118" r="4.5" fill="#2563EB" />
    <circle cx="122" cy="98" r="4.5" fill="#06B6D4" />
    
    {/* Bottleneck Gateway */}
    <g transform="translate(142, 43)">
      <rect x="0" y="0" width="6" height="24" fill="#334155" rx="1" />
      <rect x="18" y="0" width="6" height="24" fill="#334155" rx="1" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="#EF4444" strokeWidth="1.5" />
    </g>

    {/* Forecast graph overlay hovering above */}
    <path d="M40 55 L80 40 L120 65 L160 25" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="160" cy="25" r="4" fill="#10B981" />
    <circle cx="160" cy="25" r="8" stroke="#10B981" strokeWidth="1" className="svg-pulse" />
    
    {/* Forecasting grid lines */}
    <line x1="40" y1="75" x2="160" y2="75" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
  </svg>
);

// 8. Premium Interactive Operational Command Visualization
export const SectorMapIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 420 340" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes radar-scan {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes pulse-node {
        0% { transform: scale(0.8); opacity: 0.9; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      @keyframes dash-move {
        to { stroke-dashoffset: -20; }
      }
      .radar-sweep { transform-origin: 210px 170px; animation: radar-scan 8s linear infinite; }
      .pulse-alert { transform-origin: 300px 130px; animation: pulse-node 2.2s infinite cubic-bezier(0.165, 0.84, 0.44, 1); }
      .pulse-alert-2 { transform-origin: 120px 220px; animation: pulse-node 2.8s infinite cubic-bezier(0.165, 0.84, 0.44, 1); }
      .dash-path { stroke-dasharray: 4, 3; animation: dash-move 1.5s linear infinite; }
    `}</style>

    <defs>
      <radialGradient id="map-bg-glow" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#0B132B" />
        <stop offset="100%" stopColor="#050914" />
      </radialGradient>
      <radialGradient id="incident-glow" cx="300" cy="130" r="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="warning-glow" cx="120" cy="220" r="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="scan-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Background Screen */}
    <rect width="420" height="340" fill="url(#map-bg-glow)" />

    {/* Tech Grid Lines */}
    <g stroke="#1E293B" strokeWidth="0.5" opacity="0.6">
      <path d="M 0 42.5 h 420 M 0 85 h 420 M 0 127.5 h 420 M 0 170 h 420 M 0 212.5 h 420 M 0 255 h 420 M 0 297.5 h 420" />
      <path d="M 52.5 0 v 340 M 105 0 v 340 M 157.5 0 v 340 M 210 0 v 340 M 262.5 0 v 340 M 315 0 v 340 M 367.5 0 v 340" />
    </g>

    {/* Concentric Radar Rings */}
    <circle cx="210" cy="170" r="130" stroke="#1E293B" strokeWidth="1" />
    <circle cx="210" cy="170" r="100" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" />
    <circle cx="210" cy="170" r="70" stroke="#334155" strokeWidth="1" />
    <circle cx="210" cy="170" r="40" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="2 2" />

    {/* Angle Crosshairs */}
    <line x1="210" y1="30" x2="210" y2="310" stroke="#334155" strokeWidth="0.8" />
    <line x1="70" y1="170" x2="350" y2="170" stroke="#334155" strokeWidth="0.8" />
    <line x1="118" y1="78" x2="302" y2="262" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="4 4" />
    <line x1="118" y1="262" x2="302" y2="78" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="4 4" />

    {/* Sector Divisions */}
    <path d="M 210 170 L 320 60" stroke="#0EA5E9" strokeWidth="1" opacity="0.3" />
    <path d="M 210 170 L 100 280" stroke="#0EA5E9" strokeWidth="1" opacity="0.3" />

    {/* Sector Heat overlays */}
    <circle cx="300" cy="130" r="40" fill="url(#incident-glow)" />
    <circle cx="120" cy="220" r="30" fill="url(#warning-glow)" />

    {/* Active Target Indicators */}
    {/* Incident Node 1 (Critical Red) */}
    <circle cx="300" cy="130" r="12" stroke="#EF4444" strokeWidth="1" className="pulse-alert" fill="none" />
    <circle cx="300" cy="130" r="4" fill="#EF4444" />
    
    {/* Warning Node 2 (Orange Warning) */}
    <circle cx="120" cy="220" r="10" stroke="#F59E0B" strokeWidth="1" className="pulse-alert-2" fill="none" />
    <circle cx="120" cy="220" r="3.5" fill="#F59E0B" />

    {/* Safe Node 3 (Green Active) */}
    <circle cx="230" cy="100" r="3" fill="#10B981" />
    <circle cx="170" cy="240" r="3" fill="#10B981" />

    {/* Dispatch Route Paths */}
    <path d="M 210 170 C 250 150, 270 140, 300 130" stroke="#3B82F6" strokeWidth="1.5" fill="none" className="dash-path" />
    <path d="M 210 170 C 180 190, 150 200, 120 220" stroke="#F59E0B" strokeWidth="1.5" fill="none" className="dash-path" opacity="0.8" />

    {/* Radar Sweep Sector */}
    <path d="M 210 170 L 302 78 A 130 130 0 0 0 210 40 Z" fill="url(#scan-gradient)" className="radar-sweep" />

    {/* Compass scale indicators */}
    <text x="210" y="25" textAnchor="middle" fill="#475569" fontSize="7" fontWeight="bold">000° N</text>
    <text x="210" y="322" textAnchor="middle" fill="#475569" fontSize="7" fontWeight="bold">180° S</text>
    <text x="355" y="173" fill="#475569" fontSize="7" fontWeight="bold">090° E</text>
    <text x="45" y="173" fill="#475569" fontSize="7" fontWeight="bold">270° W</text>

    {/* Inline Telemetry UI Panels */}
    <g opacity="0.8">
      {/* Top Left Stats Panel */}
      <rect x="15" y="15" width="90" height="40" rx="6" fill="#0B0F19" stroke="#1E293B" strokeWidth="1" />
      <text x="23" y="27" fill="#64748B" fontSize="6" fontWeight="bold">ACTIVE SECTORS</text>
      <text x="23" y="46" fill="#F8FAFC" fontSize="14" fontWeight="black" fontFamily="monospace">06/06</text>
      <circle cx="88" cy="38" r="3" fill="#10B981" />

      {/* Top Right Stats Panel */}
      <rect x="315" y="15" width="90" height="40" rx="6" fill="#0B0F19" stroke="#1E293B" strokeWidth="1" />
      <text x="323" y="27" fill="#64748B" fontSize="6" fontWeight="bold">SYSTEM STATUS</text>
      <text x="323" y="46" fill="#38BDF8" fontSize="12" fontWeight="black" fontFamily="monospace">SECURE</text>

      {/* Bottom Left Panel */}
      <rect x="15" y="285" width="90" height="40" rx="6" fill="#0B0F19" stroke="#1E293B" strokeWidth="1" />
      <text x="23" y="297" fill="#64748B" fontSize="6" fontWeight="bold">CROWD INDEX</text>
      <text x="23" y="316" fill="#10B981" fontSize="12" fontWeight="black" fontFamily="monospace">OPTIMAL</text>

      {/* Bottom Right Panel */}
      <rect x="315" y="285" width="90" height="40" rx="6" fill="#0B0F19" stroke="#1E293B" strokeWidth="1" />
      <text x="323" y="297" fill="#64748B" fontSize="6" fontWeight="bold">SCAN RATE</text>
      <text x="323" y="316" fill="#F8FAFC" fontSize="12" fontWeight="black" fontFamily="monospace">142/sec</text>
    </g>

    {/* Sector Text Labels */}
    <text x="140" y="110" fill="#334155" fontSize="8" fontWeight="bold" letterSpacing="0.05em">SEC A</text>
    <text x="250" y="110" fill="#334155" fontSize="8" fontWeight="bold" letterSpacing="0.05em">SEC B</text>
    <text x="270" y="220" fill="#334155" fontSize="8" fontWeight="bold" letterSpacing="0.05em">SEC C</text>
    <text x="140" y="220" fill="#334155" fontSize="8" fontWeight="bold" letterSpacing="0.05em">SEC D</text>
  </svg>
);

// 9. Premium Widescreen Dashboard Scene (Interactive Command Center)
export const CrowdShieldScene: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 35 560 420" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{`
      .bg-stand-line { stroke: #E2E8F0; stroke-width: 1; }
      .dark .bg-stand-line { stroke: #1E293B; stroke-width: 1; }
      .chair-base { fill: #CBD5E1; }
      .dark .chair-base { fill: #1E293B; }
      .chair-body { fill: #94A3B8; }
      .dark .chair-body { fill: #334155; }
      .desk-leg { fill: #E2E8F0; }
      .dark .desk-leg { fill: #1E293B; }
      .desk-surface { fill: #F1F5F9; stroke: #E2E8F0; }
      .dark .desk-surface { fill: #0B1525; stroke: #1E293B; }
      .desk-edge { fill: #CBD5E1; }
      .dark .desk-edge { fill: #1E293B; }
      .placeholder-item-muted { fill: #CBD5E1; }
      .dark .placeholder-item-muted { fill: #334155; }
      .placeholder-item { fill: #E2E8F0; }
      .dark .placeholder-item { fill: #1E293B; }
      .card-bg { fill: #FFFFFF; stroke: #E2E8F0; }
      .dark .card-bg { fill: #0B0F19; stroke: #1E293B; }
      .radar-hand { transform-origin: 280px 200px; animation: radar-rotate 8s linear infinite; }
      .pulse-alert-ring { transform-origin: 320px 200px; animation: pulse-ring 2.8s infinite cubic-bezier(0.165, 0.84, 0.44, 1); }
      .float-card-1 { animation: float-delayed 6s ease-in-out infinite; }
      .float-card-2 { animation: float 5s ease-in-out infinite; }
      .float-card-3 { animation: float-delayed 7s ease-in-out infinite; }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      @keyframes float-delayed {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
      }
      @keyframes radar-rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes pulse-ring {
        0% { transform: scale(0.85); opacity: 0.9; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    `}</style>

    <defs>
      {/* Drop Shadow filter for premium card style */}
      <filter id="premium-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.07" />
      </filter>

      {/* Desk Leg Gradient */}
      <linearGradient id="leg-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#CBD5E1" />
        <stop offset="50%" stopColor="#E2E8F0" />
        <stop offset="100%" stopColor="#CBD5E1" />
      </linearGradient>

      {/* Curved Screen Display Gradient */}
      <radialGradient id="screen-glow-grad" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#1E2B48" />
        <stop offset="60%" stopColor="#0B0F19" />
        <stop offset="100%" stopColor="#050811" />
      </radialGradient>

      {/* Radar Cone Gradient */}
      <radialGradient id="radar-cone" cx="280" cy="200" r="80" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
      </radialGradient>

      {/* Safety Map Density Zones */}
      <radialGradient id="green-zone" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#10B981" stopOpacity="0.65" />
        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
      </radialGradient>
      
      <radialGradient id="blue-zone" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.65" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="red-zone" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
      </radialGradient>

      {/* Analytics Chart Fills */}
      <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* ─── BACKGROUND STADIUM SILHOUETTES ─── */}
    <g opacity="0.4">
      <path d="M 40,80 Q 280,30 520,80" fill="none" className="bg-stand-line" strokeWidth="8" strokeDasharray="10 25" opacity="0.3" />
      <path d="M 20,100 Q 280,50 540,100" fill="none" className="bg-stand-line" strokeWidth="6" strokeDasharray="8 20" opacity="0.2" />
    </g>

    {/* ─── SOFT DATA STREAMS (Dotted connections) ─── */}
    <path d="M 95,150 C 95,200 130,220 180,220" stroke="#3B82F6" strokeWidth="1.2" strokeDasharray="3 4" fill="none" opacity="0.25" />
    <path d="M 465,150 C 465,200 430,220 380,220" stroke="#8B5CF6" strokeWidth="1.2" strokeDasharray="3 4" fill="none" opacity="0.25" />
    <path d="M 475,325 C 490,340 480,365 440,385" stroke="#10B981" strokeWidth="1.2" strokeDasharray="3 4" fill="none" opacity="0.25" />

    {/* ─── SCREEN STAND & CURVED WIDESCREEN ─── */}
    {/* Stand Base */}
    <ellipse cx="280" cy="365" rx="36" ry="10" className="chair-base" />
    <rect x="274" y="315" width="12" height="50" className="chair-body" />
    
    {/* Curved Bezel Back */}
    <path d="M 94,136 Q 280,112 466,136 L 466,294 Q 280,270 94,294 Z" fill="#1E293B" />
    
    {/* Display Screen */}
    <path d="M 100,142 Q 280,118 460,142 L 460,288 Q 280,264 100,288 Z" fill="url(#screen-glow-grad)" />

    {/* ─── SCREEN DISPLAY CONTENT (Safety Dashboard Map) ─── */}
    <g opacity="0.85">
      {/* Stadium Grid Circles */}
      <ellipse cx="280" cy="200" rx="85" ry="46" stroke="#1E293B" strokeWidth="1.5" fill="none" opacity="0.4" />
      <ellipse cx="280" cy="200" rx="85" ry="46" stroke="#475569" strokeWidth="0.8" strokeDasharray="4 4" fill="none" opacity="0.3" />
      
      {/* Center Field */}
      <ellipse cx="280" cy="200" rx="52" ry="26" fill="#111B30" stroke="#334155" strokeWidth="1" />
      <line x1="280" y1="174" x2="280" y2="226" stroke="#334155" strokeWidth="0.75" opacity="0.5" />
      <circle cx="280" cy="200" r="8" stroke="#334155" strokeWidth="0.75" fill="none" opacity="0.5" />

      {/* Safety Map Heatmap Glows */}
      {/* Top Left (Green / Safe) */}
      <ellipse cx="240" cy="195" rx="16" ry="8" fill="url(#green-zone)" />
      <circle cx="240" cy="195" r="2.5" fill="#10B981" />
      
      {/* Center (Blue / Active) */}
      <ellipse cx="270" cy="205" rx="14" ry="7" fill="url(#blue-zone)" />
      <circle cx="270" cy="205" r="2.5" fill="#3B82F6" />

      {/* Right Side (Red / Alert Congestion) */}
      <ellipse cx="320" cy="200" rx="20" ry="10" fill="url(#red-zone)" />
      <circle cx="320" cy="200" r="3" fill="#EF4444" />
      
      {/* Target Focus & Pulsing Alert */}
      <ellipse cx="320" cy="200" rx="20" ry="10" stroke="#EF4444" strokeWidth="1" className="pulse-alert-ring" fill="none" />
      <line x1="320" y1="185" x2="320" y2="215" stroke="#EF4444" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.7" />
      <line x1="300" y1="200" x2="340" y2="200" stroke="#EF4444" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.7" />

      {/* Radar Sweep */}
      <path d="M 280,200 L 332,175 A 60,30 0 0,0 280,170 Z" fill="url(#radar-cone)" className="radar-hand" />
      <line x1="280" y1="200" x2="332" y2="175" stroke="#38BDF8" strokeWidth="0.75" className="radar-hand" />
    </g>

    {/* ─── CONSOLE DESK ─── */}
    {/* Desk legs */}
    <rect x="200" y="380" width="12" height="70" className="desk-leg" fill="url(#leg-grad)" />
    <rect x="348" y="380" width="12" height="70" className="desk-leg" fill="url(#leg-grad)" />
    
    {/* Base Shadow */}
    <ellipse cx="280" cy="445" rx="150" ry="10" fill="#0F172A" opacity="0.06" />

    {/* Desk Top face */}
    <path d="M 60,370 L 500,370 Q 520,370 500,400 L 460,430 Q 445,440 420,440 L 140,440 Q 115,440 100,430 L 60,400 Q 40,370 60,370 Z" className="desk-surface" strokeWidth="1.5" />
    
    {/* Desk side thickness */}
    <path d="M 60,400 L 100,430 Q 115,440 140,440 L 420,440 Q 445,440 460,430 L 500,400 L 500,405 L 460,435 Q 445,445 420,445 L 140,445 Q 115,445 100,435 L 60,405 Z" className="desk-edge" />

    {/* ─── DESK ACCESSORIES ─── */}
    {/* Keyboard */}
    <rect x="235" y="405" width="55" height="18" rx="3" fill="#94A3B8" opacity="0.3" />
    <rect x="238" y="407" width="49" height="14" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5" />
    <line x1="242" y1="411" x2="282" y2="411" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="1.5 1" />
    <line x1="244" y1="415" x2="280" y2="415" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="2 1" />
    
    {/* Mouse */}
    <ellipse cx="305" cy="416" rx="4.5" ry="6.5" fill="#94A3B8" opacity="0.35" />

    {/* Tablet Screen */}
    <rect x="150" y="395" width="40" height="25" rx="3" transform="skewX(-15)" fill="#475569" stroke="#E2E8F0" strokeWidth="0.75" />
    <rect x="153" y="398" width="34" height="19" rx="1.5" transform="skewX(-15)" fill="#38BDF8" opacity="0.15" />
    <circle cx="170" cy="408" r="2.5" transform="skewX(-15)" fill="#38BDF8" opacity="0.8" />

    {/* Coffee Mug */}
    <path d="M 345,405 L 353,405 L 352,417 L 346,417 Z" fill="#EF4444" />
    <path d="M 352,408 Q 356,411 352,414" stroke="#EF4444" strokeWidth="1.2" fill="none" />
    <ellipse cx="349" cy="405" rx="3" ry="0.8" fill="#78350F" />

    {/* ─── OPERATOR 1 (Sitting in Chair) ─── */}
    {/* Ergonomic Chair */}
    <path d="M 160,335 C 160,290 178,280 190,280 C 202,280 220,290 220,335 L 215,385 C 215,395 205,400 190,400 C 175,400 165,395 165,385 Z" className="chair-body" />
    <ellipse cx="190" cy="385" rx="24" ry="7" className="chair-base" />
    <rect x="186" y="390" width="8" height="40" className="chair-base" />
    <path d="M 170,430 L 210,430 M 190,425 L 190,435" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
    
    {/* Person Torso */}
    <path d="M 170,385 C 170,330 180,310 190,310 C 200,310 210,330 210,385 Z" fill="#2563EB" />
    
    {/* Arms typing */}
    <path d="M 175,340 Q 200,345 228,408" stroke="#2563EB" strokeWidth="7" strokeLinecap="round" fill="none" />
    <path d="M 205,340 Q 215,345 242,410" stroke="#2563EB" strokeWidth="7" strokeLinecap="round" fill="none" />
    <circle cx="228" cy="408" r="3.5" fill="#FDBA74" />
    <circle cx="242" cy="410" r="3.5" fill="#FDBA74" />

    {/* Head & Hair */}
    <circle cx="190" cy="298" r="11" fill="#FDBA74" />
    <path d="M 180,295 C 180,283 200,283 200,295 L 202,298 C 202,289 178,289 178,298 Z" fill="#451A03" />
    
    {/* Headset */}
    <path d="M 182,290 A 11,11 0 0,1 198,290" fill="none" stroke="#1E293B" strokeWidth="1.5" />
    <circle cx="181" cy="293" r="2" fill="#1E293B" />
    <path d="M 190,298 Q 197,304 197,307" stroke="#1E293B" strokeWidth="1" fill="none" />
    <circle cx="197" cy="307" r="1.2" fill="#3B82F6" />

    {/* ─── OPERATOR 2 (Standing, Pointing) ─── */}
    {/* Pants */}
    <rect x="364" y="388" width="9" height="52" rx="2.5" className="chair-base" />
    <rect x="376" y="388" width="9" height="52" rx="2.5" className="chair-base" />
    <ellipse cx="374" cy="440" rx="14" ry="4" fill="#0F172A" opacity="0.08" />

    {/* Torso */}
    <path d="M 358,390 L 388,390 L 382,310 C 382,300 364,300 364,310 Z" fill="#10B981" />
    
    {/* Pointing Arm */}
    <path d="M 368,318 L 340,290 L 295,260" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="295" cy="260" r="3.5" fill="#FED7AA" />
    
    {/* Standby Arm */}
    <path d="M 380,320 Q 388,335 385,365" stroke="#10B981" strokeWidth="7" strokeLinecap="round" fill="none" />

    {/* Head & Hair */}
    <circle cx="373" cy="285" r="11" fill="#FED7AA" />
    <circle cx="373" cy="270" r="4.2" fill="#1E293B" />
    <path d="M 363,282 C 363,272 383,272 383,282 Z" fill="#1E293B" />

    {/* ─── FLOATING ANALYTICS CARDS (With Premium Shadow Filters) ─── */}
    {/* Card 1: Safety Indicator Circular Meter */}
    <g className="float-card-1">
      <rect x="30" y="60" width="130" height="90" rx="14" className="card-bg" strokeWidth="1" filter="url(#premium-shadow)" />
      
      {/* Visual Text Placeholder Rows */}
      <rect x="45" y="75" width="55" height="5" rx="2.5" className="placeholder-item-muted" />
      <rect x="45" y="85" width="30" height="4" rx="2" className="placeholder-item" opacity="0.5" />
      
      {/* Circular Progress Gauge */}
      <circle cx="95" cy="112" r="20" stroke="#E2E8F0" strokeWidth="4" fill="none" className="placeholder-item" opacity="0.3" />
      <circle cx="95" cy="112" r="20" stroke="#10B981" strokeWidth="4" strokeDasharray="100 30" strokeLinecap="round" fill="none" />
      
      {/* Miniature Shield Emblem inside circle */}
      <path d="M 95,106 L 99,109 L 99,114 C 99,117 95,119 95,119 C 95,119 91,117 91,114 L 91,109 Z" fill="#10B981" />
    </g>

    {/* Card 2: Analytics Line Chart Spline */}
    <g className="float-card-2">
      <rect x="400" y="60" width="130" height="90" rx="14" className="card-bg" strokeWidth="1" filter="url(#premium-shadow)" />
      
      {/* Title Placeholder */}
      <rect x="415" y="75" width="45" height="5" rx="2.5" className="placeholder-item-muted" />
      
      {/* Dotted Grid lines */}
      <line x1="415" y1="122" x2="515" y2="122" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" className="placeholder-item" opacity="0.5" />
      <line x1="415" y1="108" x2="515" y2="108" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" className="placeholder-item" opacity="0.5" />

      {/* Chart line and area fill */}
      <path d="M 415,135 Q 430,110 445,120 T 475,95 T 515,115 L 515,142 L 415,142 Z" fill="url(#chart-area-grad)" />
      <path d="M 415,135 Q 430,110 445,120 T 475,95 T 515,115" fill="none" stroke="#8B5CF6" strokeWidth="2.2" strokeLinecap="round" />
      
      {/* Tiny chart node */}
      <circle cx="475" cy="95" r="3" fill="#8B5CF6" />
    </g>

    {/* Card 3: Status / Queue Levels Feed */}
    <g className="float-card-3">
      <rect x="415" y="240" width="115" height="80" rx="14" className="card-bg" strokeWidth="1" filter="url(#premium-shadow)" />
      
      {/* Title */}
      <rect x="428" y="253" width="55" height="5" rx="2.5" className="placeholder-item-muted" />
      
      {/* Ingress Row 1 */}
      <circle cx="433" cy="272" r="3.5" fill="#10B981" />
      <rect x="442" y="270" width="45" height="4" rx="2" className="placeholder-item" />
      
      {/* Ingress Row 2 */}
      <circle cx="433" cy="286" r="3.5" fill="#3B82F6" />
      <rect x="442" y="284" width="58" height="4" rx="2" className="placeholder-item" />
      {/* Ingress Row 3 */}
      <circle cx="433" cy="300" r="3.5" fill="#EF4444" />
      <rect x="442" y="298" width="38" height="4" rx="2" className="placeholder-item" />
    </g>
  </svg>
);

export const LoginCartoonIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 750 800" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes float-plane {
        0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
        50% { transform: translateY(-10px) translateX(8px) rotate(2deg); }
      }
      @keyframes float-bubble {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      @keyframes dash-coordination {
        to { stroke-dashoffset: -40; }
      }
      @keyframes scan-laser {
        0%, 100% { transform: translateY(0px); opacity: 0.2; }
        50% { transform: translateY(215px); opacity: 0.95; }
      }
      .anim-plane { animation: float-plane 6s ease-in-out infinite; }
      .anim-bubble { animation: float-bubble 4.5s ease-in-out infinite; }
      .anim-dash-coordination { stroke-dasharray: 8 6; animation: dash-coordination 2.5s linear infinite; }
      .laser-line { animation: scan-laser 2.5s infinite ease-in-out; }
      .bg-grid { stroke: var(--slate-850); opacity: 0.15; transition: stroke 0.3s ease; }
      .event-arch { stroke: var(--slate-800); stroke-width: 16; fill: none; opacity: 0.12; transition: stroke 0.3s ease; }
      .stadium-silhouette { stroke: var(--slate-850); stroke-width: 2; fill: none; opacity: 0.15; transition: stroke 0.3s ease; }
    `}</style>

    <defs>
      {/* Background Tech Gradients */}
      <linearGradient id="bg-fade-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--slate-950)" stopOpacity="0.85" />
        <stop offset="65%" stopColor="var(--slate-950)" stopOpacity="0.4" />
        <stop offset="100%" stopColor="var(--slate-950)" stopOpacity="0" />
      </linearGradient>
      
      <linearGradient id="blob-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
      </linearGradient>

      {/* Laser fill gradient */}
      <linearGradient id="laser-glow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
      </linearGradient>

      {/* Spotlight gradient */}
      <linearGradient id="spotlight-grad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* ─── EVENT STADIUM SILHOUETTES ─── */}
    <path d="M 50,660 L 50,300 C 50,150 700,150 700,300 L 700,660" className="event-arch" />
    <path d="M 100,660 Q 200,450 400,480 T 700,660" className="stadium-silhouette" />

    {/* ─── ISOMETRIC PERSPECTIVE FLOOR GRID (CROWDWAY) ─── */}
    <g className="bg-grid">
      <line x1="30" y1="660" x2="720" y2="660" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="695" x2="740" y2="695" strokeWidth="1" />
      <line x1="0" y1="735" x2="750" y2="735" strokeWidth="1" />
      <line x1="0" y1="780" x2="750" y2="780" strokeWidth="1" />
      
      {/* Perspective Lines */}
      <line x1="90" y1="660" x2="30" y2="800" strokeWidth="1" />
      <line x1="220" y1="660" x2="180" y2="800" strokeWidth="1" />
      <line x1="380" y1="660" x2="380" y2="800" strokeWidth="1" />
      <line x1="560" y1="660" x2="600" y2="800" strokeWidth="1" />
    </g>

    {/* ─── QUEUE STANCHIONS & ROPE SYSTEM (CROWD MANAGEMENT) ─── */}
    <g>
      {/* Red Velvet Rope (Draped between stanchions) */}
      <path d="M 60,535 Q 112,555 165,535" stroke="#EF4444" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 165,535 Q 217,555 270,535" stroke="#EF4444" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 270,535 Q 312,550 345,535" stroke="#EF4444" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Stanchion 1 */}
      <ellipse cx="60" cy="660" rx="14" ry="4" fill="var(--slate-700)" />
      <rect x="57" y="520" width="6" height="140" rx="2" fill="var(--slate-400)" />
      <circle cx="60" cy="518" r="5.5" fill="var(--slate-500)" />

      {/* Stanchion 2 */}
      <ellipse cx="165" cy="660" rx="14" ry="4" fill="var(--slate-700)" />
      <rect x="162" y="520" width="6" height="140" rx="2" fill="var(--slate-400)" />
      <circle cx="165" cy="518" r="5.5" fill="var(--slate-500)" />

      {/* Stanchion 3 */}
      <ellipse cx="270" cy="660" rx="14" ry="4" fill="var(--slate-700)" />
      <rect x="267" y="520" width="6" height="140" rx="2" fill="var(--slate-400)" />
      <circle cx="270" cy="518" r="5.5" fill="var(--slate-500)" />
    </g>

    {/* ─── ATTENDEE QUEUE (REAL PROPORTIONS & CULTURAL OUTFITS) ─── */}
    
    {/* 1. Attendee 1: Indian Woman in Yellow/Orange Kurti & Red Dupatta */}
    <g>
      {/* Hair (Black Braid) */}
      <path d="M 85,450 Q 80,480 84,510" stroke="#1A1A1A" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="84" cy="514" r="4" fill="#1A1A1A" />

      {/* Head & Skin */}
      <circle cx="90" cy="435" r="16" fill="#C68642" />
      <path d="M 74,435 C 74,420 106,420 106,435 Z" fill="#1A1A1A" /> {/* Hair Front */}
      
      {/* Cultural Bindi & Face Details */}
      <circle cx="90" cy="429" r="1.5" fill="#EF4444" />
      <circle cx="84" cy="434" r="1.8" fill="#1A1A1A" />
      <circle cx="96" cy="434" r="1.8" fill="#1A1A1A" />
      <path d="M 86,441 Q 90,444 94,441" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="87" y="449" width="6" height="12" fill="#C68642" />

      {/* Torso: Curved Mustard Yellow Tunic (Kurti) */}
      <path d="M 68,460 C 66,460 65,470 66,490 L 70,550 C 70,555 75,560 90,560 C 105,560 110,555 110,550 L 114,490 C 115,470 114,460 112,460 Z" fill="#F59E0B" />
      
      {/* Traditional Red Dupatta (Scarf draped gracefully) */}
      <path d="M 68,461 Q 90,490 112,461 L 108,540 Q 90,550 72,540 Z" fill="#EF4444" opacity="0.9" />

      {/* Expressive Arm holding a Handbag */}
      <path d="M 70,470 Q 56,490 62,510" stroke="#F59E0B" strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="62" cy="510" r="4.5" fill="#C68642" />
      {/* Handbag */}
      <path d="M 58,510 L 66,510 L 69,530 L 55,530 Z" fill="#7F1D1D" />
      <path d="M 58,510 Q 62,500 66,510" stroke="#7F1D1D" strokeWidth="2" fill="none" />

      {/* Legs: Realistic Pajama/Salwar (Shorter, normal human proportion) */}
      <rect x="73" y="560" width="15" height="90" rx="3" fill="#FFFFFF" />
      <rect x="92" y="560" width="15" height="90" rx="3" fill="#FFFFFF" />

      {/* Shoes */}
      <rect x="70" y="646" width="19" height="15" rx="5" fill="#C68642" />
      <rect x="91" y="646" width="19" height="15" rx="5" fill="#C68642" />
    </g>

    {/* 2. Attendee 2: Indian Man in White Kurta & Deep Blue Nehru Jacket */}
    <g>
      {/* Head, Hair & Beard */}
      <circle cx="175" cy="435" r="16" fill="#AE703B" />
      <path d="M 159,435 C 159,418 191,418 191,435 Z" fill="#1A1A1A" />
      <path d="M 159,438 Q 175,454 191,438 C 191,452 159,452 159,438 Z" fill="#1A1A1A" /> {/* Beard */}

      {/* Face Details */}
      <circle cx="169" cy="433" r="1.8" fill="#FFFFFF" />
      <circle cx="181" cy="433" r="1.8" fill="#FFFFFF" />
      <path d="M 171,440 Q 175,443 179,440" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="172" y="449" width="6" height="12" fill="#AE703B" />

      {/* Torso: White Kurta under Blue Nehru Waistcoat */}
      <path d="M 153,460 C 151,460 150,470 151,490 L 155,550 C 155,555 160,560 175,560 C 190,560 195,555 195,550 L 199,490 C 200,470 199,460 197,460 Z" fill="#FFFFFF" />
      {/* Nehru Waistcoat Overlay */}
      <path d="M 155,460 L 195,460 L 191,545 L 159,545 Z" fill="#1E3A8A" />
      <line x1="175" y1="465" x2="175" y2="540" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="3 3" />

      {/* Left/Right Arms */}
      <path d="M 154,470 Q 144,495 152,520" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="152" cy="520" r="4.5" fill="#AE703B" />
      <path d="M 196,470 Q 206,495 198,520" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="198" cy="520" r="4.5" fill="#AE703B" />

      {/* Legs: Grey Pants (Shorter, proportioned) */}
      <rect x="157" y="560" width="16" height="90" rx="3" fill="#475569" />
      <rect x="177" y="560" width="16" height="90" rx="3" fill="#475569" />

      {/* Shoes */}
      <rect x="154" y="646" width="20" height="15" rx="5" fill="#0F172A" />
      <rect x="176" y="646" width="20" height="15" rx="5" fill="#0F172A" />
    </g>

    {/* 3. Attendee 3: Indian Woman in Emerald Green Saree / Kurti with Pink Accent */}
    <g>
      {/* Hair (Elegant Bun) */}
      <circle cx="272" cy="420" r="7.5" fill="#1A1A1A" />
      <circle cx="260" cy="435" r="16" fill="#E0AC69" />
      <path d="M 244,435 C 244,420 276,420 276,435 Z" fill="#1A1A1A" />

      {/* Face Details */}
      <circle cx="260" cy="429" r="1.5" fill="#EF4444" /> {/* Bindi */}
      <circle cx="254" cy="434" r="1.8" fill="#1A1A1A" />
      <circle cx="266" cy="434" r="1.8" fill="#1A1A1A" />
      <path d="M 256,441 Q 260,444 264,441" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="257" y="449" width="6" height="12" fill="#E0AC69" />

      {/* Torso: Green Top / Saree drape */}
      <path d="M 238,460 C 236,460 235,470 236,490 L 240,550 C 240,555 245,560 260,560 C 275,560 280,555 280,550 L 284,490 C 285,470 284,460 282,460 Z" fill="#10B981" />
      {/* Pink Saree pallu drape */}
      <path d="M 238,461 Q 252,500 280,550 L 265,557 Q 242,500 238,461 Z" fill="#EC4899" />

      {/* Legs: Navy Pants */}
      <rect x="243" y="560" width="15" height="90" rx="3" fill="#1E293B" />
      <rect x="262" y="560" width="15" height="90" rx="3" fill="#1E293B" />

      {/* Shoes */}
      <rect x="240" y="646" width="19" height="15" rx="5" fill="#F97316" />
      <rect x="261" y="646" width="19" height="15" rx="5" fill="#F97316" />
    </g>

    {/* ─── SMART CHECKPOINT GATE (CROWDWAY SEGMENT) ─── */}
    <g>
      {/* Scanning Laser Glow Field */}
      <rect x="357" y="445" width="48" height="215" fill="url(#laser-glow)" opacity="0.3" />
      <line x1="357" y1="445" x2="405" y2="445" stroke="#06B6D4" strokeWidth="4" className="laser-line" />

      {/* Left Scanner Pillar */}
      <rect x="345" y="440" width="12" height="220" rx="3.5" fill="#475569" stroke="var(--slate-800)" strokeWidth="1" />
      <rect x="347" y="465" width="8" height="20" rx="1.5" fill="#10B981" />
      <circle cx="351" cy="450" r="2.5" fill="#10B981" />

      {/* Right Scanner Pillar */}
      <rect x="405" y="440" width="12" height="220" rx="3.5" fill="#475569" stroke="var(--slate-800)" strokeWidth="1" />
      <circle cx="411" cy="450" r="2.5" fill="#10B981" />

      {/* Overhead Smart Gate Status Sign */}
      <rect x="335" y="375" width="92" height="28" rx="5" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="1.5" />
      <text x="381" y="393" fill="#FFFFFF" fontSize="8" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.05em">GATE A - ACTIVE</text>

      {/* Floating Checkmark Scan Indicator */}
      <g className="anim-bubble" opacity="0.95">
        <circle cx="381" cy="340" r="16" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="2.5" />
        <path d="M 374,340 L 379,345 L 389,333" stroke="#10B981" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>

    {/* 4. Attendee 4: Indian Woman in Indigo Blue Kurti & White Salwar (Inside Gate Scanner) */}
    <g>
      {/* Hair (Ponytail) */}
      <path d="M 360,450 Q 352,465 353,485" stroke="#1A1A1A" strokeWidth="5.5" strokeLinecap="round" fill="none" />

      {/* Head */}
      <circle cx="375" cy="435" r="16" fill="#F1C27D" />
      <path d="M 359,435 C 359,420 391,420 391,435 Z" fill="#1A1A1A" />
      
      {/* Face Details */}
      <circle cx="375" cy="429" r="1.5" fill="#EF4444" />
      <circle cx="369" cy="434" r="1.8" fill="#1A1A1A" />
      <circle cx="381" cy="434" r="1.8" fill="#1A1A1A" />
      <path d="M 371,441 Q 375,444 379,441" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="372" y="449" width="6" height="12" fill="#F1C27D" />

      {/* Torso: Indigo Tunic */}
      <path d="M 353,460 C 351,460 350,470 351,490 L 355,550 C 355,555 360,560 375,560 C 390,560 395,555 395,550 L 399,490 C 400,470 399,460 397,460 Z" fill="#2563EB" />
      <path d="M 353,461 Q 375,490 397,461 L 393,540 Q 375,550 357,540 Z" fill="#FFFFFF" opacity="0.85" />

      {/* Arm holding scanning phone */}
      <path d="M 358,475 Q 346,495 338,505" stroke="#2563EB" strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="338" cy="505" r="4.5" fill="#F1C27D" />
      <rect x="333" y="495" width="8" height="15" rx="1.5" fill="#22C55E" />

      {/* Legs: White Pajama */}
      <rect x="358" y="560" width="15" height="90" rx="3" fill="#FFFFFF" />
      <rect x="377" y="560" width="15" height="90" rx="3" fill="#FFFFFF" />

      {/* Shoes */}
      <rect x="355" y="646" width="19" height="15" rx="5" fill="#EF4444" />
      <rect x="376" y="646" width="19" height="15" rx="5" fill="#EF4444" />
    </g>

    {/* ─── SECURITY OFFICER (DIRECTING TRAFFIC FLOW) ─── */}
    <g>
      {/* Head, Hair & Mustache */}
      <circle cx="460" cy="435" r="16" fill="#C68642" />
      <path d="M 444,435 C 444,418 476,418 476,435 Z" fill="#1A1A1A" />
      <path d="M 452,442 C 452,438 468,438 468,442 Z" stroke="#1A1A1A" strokeWidth="2.5" fill="none" /> {/* Mustache */}

      {/* Face Details */}
      <circle cx="454" cy="433" r="1.8" fill="#FFFFFF" />
      <circle cx="466" cy="433" r="1.8" fill="#FFFFFF" />
      <path d="M 456,445 Q 460,448 464,445" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="457" y="449" width="6" height="12" fill="#C68642" />

      {/* Torso: Security Officer Blue Shirt & Shield Badge */}
      <path d="M 438,460 C 436,460 435,470 436,490 L 440,550 C 440,555 445,560 460,560 C 475,560 480,555 480,550 L 484,490 C 485,470 484,460 482,460 Z" fill="#38BDF8" />
      <path d="M 466,470 L 471,473 L 471,478 C 471,481 466,483 466,483 C 466,483 461,481 461,478 L 461,473 Z" fill="#10B981" />

      {/* Waving Welcoming Arm */}
      <path d="M 478,475 Q 492,465 500,450" stroke="#38BDF8" strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="500" cy="450" r="4.5" fill="#C68642" />

      {/* Legs: Navy Uniform Trousers */}
      <rect x="443" y="560" width="16" height="90" rx="3" fill="#1E3A8A" />
      <rect x="462" y="560" width="16" height="90" rx="3" fill="#1E3A8A" />

      {/* Shoes */}
      <rect x="440" y="646" width="20" height="15" rx="5" fill="#0F172A" />
      <rect x="461" y="646" width="20" height="15" rx="5" fill="#0F172A" />
    </g>

    {/* ─── COMMAND CENTER COORDINATOR (SITTING MONITORING DASHBOARD) ─── */}
    <g>
      {/* Swivel Chair Base */}
      <ellipse cx="570" cy="650" rx="22" ry="6" fill="#1E293B" />
      <rect x="567" y="580" width="6" height="70" fill="#1E293B" />

      {/* Chair Back Support */}
      <path d="M 545,490 C 545,475 560,465 575,465 C 590,465 600,475 600,490 L 600,560 C 600,575 585,580 570,580 C 555,580 545,575 545,560 Z" fill="#2563EB" opacity="0.85" />

      {/* Head & Hair Bun */}
      <circle cx="566" cy="425" r="7.5" fill="#1A1A1A" />
      <circle cx="578" cy="435" r="16" fill="#E0AC69" />
      <path d="M 562,435 C 562,420 594,420 594,435 Z" fill="#1A1A1A" />

      {/* Face Details */}
      <circle cx="584" cy="433" r="1.8" fill="#1A1A1A" />
      <circle cx="572" cy="433" r="1.8" fill="#1A1A1A" />
      <path d="M 576,441 Q 580,444 584,441" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="575" y="449" width="6" height="12" fill="#E0AC69" />

      {/* Torso (Maroon Top) */}
      <path d="M 556,460 L 596,460 L 592,545 L 560,545 Z" fill="#991B1B" rx="4" />

      {/* Seated Coordinator Legs */}
      <rect x="552" y="550" width="40" height="16" rx="5" fill="#475569" />
      
      {/* Console Desk Surface */}
      <rect x="515" y="540" width="85" height="12" rx="4" fill="var(--slate-900)" stroke="var(--slate-800)" strokeWidth="1" />

      {/* Laptop Monitor */}
      <path d="M 525,540 L 545,540 L 552,518" stroke="#475569" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </g>

    {/* ─── SUCCESSFUL INGRESS AREA (RIGHT SIDE) ─── */}
    
    {/* 5. Attendee 5: Indian Man in Green Kurta (Happily entering and waving) */}
    <g>
      {/* Head, Hair & beard */}
      <circle cx="680" cy="435" r="16" fill="#F1C27D" />
      <path d="M 664,435 C 664,418 696,418 696,435 Z" fill="#1A1A1A" />
      <path d="M 664,438 Q 680,454 696,438 C 696,452 664,452 664,438 Z" fill="#1A1A1A" />

      {/* Face Details */}
      <circle cx="674" cy="433" r="1.8" fill="#FFFFFF" />
      <circle cx="686" cy="433" r="1.8" fill="#FFFFFF" />
      <path d="M 676,440 Q 680,443 684,440" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />

      {/* Neck */}
      <rect x="677" y="449" width="6" height="12" fill="#F1C27D" />

      {/* Torso: Green Kurta */}
      <path d="M 658,460 C 656,460 655,470 655,490 L 659,550 C 659,555 664,560 679,560 C 694,560 699,555 699,550 L 703,490 C 704,470 703,460 701,460 Z" fill="#10B981" />
      
      {/* Happily waving hand */}
      <path d="M 698,475 Q 714,460 722,440" stroke="#10B981" strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="722" cy="440" r="4.5" fill="#F1C27D" />

      {/* Legs: White Trousers */}
      <rect x="662" y="560" width="16" height="90" rx="3" fill="#FFFFFF" />
      <rect x="682" y="560" width="16" height="90" rx="3" fill="#FFFFFF" />

      {/* Shoes */}
      <rect x="659" y="646" width="20" height="15" rx="5" fill="#F59E0B" />
      <rect x="681" y="646" width="20" height="15" rx="5" fill="#F59E0B" />
    </g>

    {/* ─── INTERCONNECTED COORDINATION DATA STREAMS ─── */}
    <path d="M 338,505 C 380,460 410,480 525,525" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" className="anim-dash-coordination" />

    {/* Floating Paper Airplanes */}
    <g className="anim-plane" opacity="0.8">
      <path d="M 330,220 L 355,205 L 342,230 L 330,220 Z M 330,220 L 355,205" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
    <g className="anim-plane" opacity="0.7" style={{ animationDelay: '2s' }}>
      <path d="M 420,180 L 445,165 L 432,190 L 420,180 Z M 420,180 L 445,165" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </g>

    {/* Floating Chat Bubbles */}
    <g className="anim-bubble" opacity="0.85">
      <rect x="235" y="230" width="45" height="30" rx="6" fill="var(--color-primary)" opacity="0.15" stroke="var(--color-primary)" strokeWidth="1.5" />
      <polygon points="250,260 255,267 260,260" fill="var(--color-primary)" opacity="0.15" stroke="var(--color-primary)" strokeWidth="1.5" />
      <line x1="243" y1="240" x2="272" y2="240" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="243" y1="248" x2="263" y2="248" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
    </g>
    <g className="anim-bubble" opacity="0.85" style={{ animationDelay: '1.5s' }}>
      <rect x="470" y="270" width="45" height="30" rx="6" fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" strokeWidth="1.5" />
      <polygon points="485,300 490,307 495,300" fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" strokeWidth="1.5" />
      <line x1="478" y1="280" x2="507" y2="280" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="478" y1="288" x2="498" y2="288" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
    </g>
  </svg>
);

// ============================================================
// Dashboard Hero Illustration — Command Center Operators
// Wide scene: 3 operators at a desk bank watching crowd density
// monitors, used as the admin dashboard hero banner decoration.
// ============================================================
export const DashboardHeroIllustration: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 520 180" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dash-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.08" />
      </linearGradient>
      <linearGradient id="desk-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
      <linearGradient id="screen-blue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1D4ED8" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <linearGradient id="screen-purple" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5B21B6" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <linearGradient id="screen-teal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0E7490" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <radialGradient id="floor-glow" cx="50%" cy="100%" r="60%">
        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
      </radialGradient>
      <filter id="soft-glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Background */}
    <rect width="520" height="180" fill="url(#dash-bg)" rx="16" />
    <ellipse cx="260" cy="180" rx="260" ry="60" fill="url(#floor-glow)" />

    {/* Floor */}
    <ellipse cx="260" cy="162" rx="220" ry="18" fill="#0F172A" opacity="0.35" />

    {/* Desk */}
    <rect x="60" y="115" width="400" height="14" rx="4" fill="url(#desk-grad)" />
    <rect x="70" y="129" width="8" height="30" rx="3" fill="#1E293B" />
    <rect x="442" y="129" width="8" height="30" rx="3" fill="#1E293B" />
    <rect x="190" y="129" width="8" height="30" rx="3" fill="#1E293B" />
    <rect x="314" y="129" width="8" height="30" rx="3" fill="#1E293B" />

    {/* Monitor 1 (left) */}
    <rect x="72" y="70" width="98" height="44" rx="5" fill="url(#screen-blue)" stroke="#2563EB" strokeWidth="1.5" />
    {/* screen content – bar chart */}
    <rect x="80" y="88" width="8" height="20" rx="2" fill="#3B82F6" opacity="0.8" />
    <rect x="93" y="80" width="8" height="28" rx="2" fill="#60A5FA" opacity="0.8" />
    <rect x="106" y="85" width="8" height="23" rx="2" fill="#3B82F6" opacity="0.8" />
    <rect x="119" y="76" width="8" height="32" rx="2" fill="#93C5FD" opacity="0.8" />
    <rect x="132" y="83" width="8" height="25" rx="2" fill="#3B82F6" opacity="0.8" />
    <rect x="145" y="78" width="8" height="30" rx="2" fill="#60A5FA" opacity="0.8" />
    {/* monitor stand */}
    <rect x="115" y="114" width="12" height="6" rx="2" fill="#334155" />
    <rect x="108" y="119" width="26" height="3" rx="2" fill="#475569" />

    {/* Monitor 2 (center) */}
    <rect x="194" y="62" width="132" height="52" rx="5" fill="url(#screen-purple)" stroke="#7C3AED" strokeWidth="1.5" filter="url(#soft-glow)" />
    {/* screen – crowd density heatmap grid */}
    {[0,1,2,3,4].map(col =>
      [0,1,2,3].map(row => {
        const colors = ['#7C3AED','#8B5CF6','#6D28D9','#A78BFA','#5B21B6'];
        const opacities = [0.9, 0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.95, 0.65, 0.8, 0.55, 0.75, 0.9, 0.45, 0.85, 0.7, 0.6, 0.9, 0.5, 0.8];
        const idx = col * 4 + row;
        return (
          <rect key={`hm-${col}-${row}`}
            x={204 + col * 23} y={72 + row * 11}
            width="20" height="9" rx="2"
            fill={colors[col]} opacity={opacities[idx % opacities.length]}
          />
        );
      })
    )}
    <text x="260" y="120" textAnchor="middle" fontSize="7" fill="#A78BFA" fontWeight="700" opacity="0.9">CROWD DENSITY LIVE</text>
    {/* monitor stand */}
    <rect x="252" y="114" width="16" height="6" rx="2" fill="#334155" />
    <rect x="244" y="119" width="32" height="3" rx="2" fill="#475569" />

    {/* Monitor 3 (right) */}
    <rect x="350" y="70" width="98" height="44" rx="5" fill="url(#screen-teal)" stroke="#06B6D4" strokeWidth="1.5" />
    {/* screen – area chart wave */}
    <path d="M 358,104 Q 370,82 382,90 Q 394,98 406,78 Q 418,60 430,85 L 440,85 L 440,108 L 358,108 Z" fill="#06B6D4" opacity="0.25" />
    <path d="M 358,104 Q 370,82 382,90 Q 394,98 406,78 Q 418,60 430,85" stroke="#22D3EE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* data points */}
    <circle cx="382" cy="90" r="3" fill="#22D3EE" />
    <circle cx="406" cy="78" r="3" fill="#22D3EE" />
    <circle cx="430" cy="85" r="3" fill="#22D3EE" />
    <text x="399" y="76" fontSize="6" fill="#22D3EE" fontWeight="700">4.2m</text>
    {/* monitor stand */}
    <rect x="391" y="114" width="16" height="6" rx="2" fill="#334155" />
    <rect x="383" y="119" width="32" height="3" rx="2" fill="#475569" />

    {/* ── Operator 1 (left) ── */}
    {/* body */}
    <rect x="93" y="90" width="20" height="26" rx="5" fill="#D97706" />
    {/* arms */}
    <rect x="85" y="95" width="10" height="6" rx="3" fill="#B45309" />
    <rect x="111" y="95" width="10" height="6" rx="3" fill="#B45309" />
    {/* head */}
    <ellipse cx="103" cy="84" rx="10" ry="10.5" fill="#92400E" />
    {/* hair */}
    <ellipse cx="103" cy="77" rx="9" ry="5" fill="#1C1917" />
    {/* face */}
    <ellipse cx="99.5" cy="85" rx="1.8" ry="2" fill="#1C1917" />
    <ellipse cx="106.5" cy="85" rx="1.8" ry="2" fill="#1C1917" />
    <path d="M 100 90 Q 103 93 106 90" stroke="#1C1917" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    {/* headset */}
    <path d="M 93,83 Q 93,73 103,73 Q 113,73 113,83" stroke="#374151" strokeWidth="2" fill="none" />
    <rect x="90" y="82" width="5" height="5" rx="2" fill="#374151" />
    <rect x="108" y="82" width="5" height="5" rx="2" fill="#374151" />
    {/* shirt */}
    <rect x="96" y="90" width="14" height="10" rx="3" fill="#1D4ED8" />

    {/* ── Operator 2 (center, female) ── */}
    <rect x="245" y="86" width="22" height="28" rx="5" fill="#7C3AED" />
    <rect x="236" y="91" width="10" height="6" rx="3" fill="#6D28D9" />
    <rect x="266" y="91" width="10" height="6" rx="3" fill="#6D28D9" />
    <ellipse cx="256" cy="79" rx="11" ry="11" fill="#A16207" />
    {/* hair bun */}
    <ellipse cx="256" cy="71" rx="10" ry="6" fill="#1C1917" />
    <circle cx="256" cy="67" r="4" fill="#1C1917" />
    {/* bindi */}
    <circle cx="256" cy="78" r="1.5" fill="#EF4444" />
    {/* eyes */}
    <ellipse cx="251.5" cy="80.5" rx="1.8" ry="2" fill="#1C1917" />
    <ellipse cx="260.5" cy="80.5" rx="1.8" ry="2" fill="#1C1917" />
    <path d="M 253 86 Q 256 89 259 86" stroke="#1C1917" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    {/* headset */}
    <path d="M 244,79 Q 244,67 256,67 Q 268,67 268,79" stroke="#374151" strokeWidth="2" fill="none" />
    <rect x="241" y="78" width="5" height="5" rx="2" fill="#374151" />
    <rect x="266" y="78" width="5" height="5" rx="2" fill="#374151" />
    {/* shirt detail */}
    <rect x="248" y="86" width="16" height="12" rx="3" fill="#5B21B6" />

    {/* ── Operator 3 (right) ── */}
    <rect x="372" y="90" width="20" height="26" rx="5" fill="#059669" />
    <rect x="364" y="95" width="10" height="6" rx="3" fill="#047857" />
    <rect x="390" y="95" width="10" height="6" rx="3" fill="#047857" />
    <ellipse cx="382" cy="83" rx="10" ry="10.5" fill="#78350F" />
    <ellipse cx="382" cy="76" rx="9" ry="5" fill="#292524" />
    {/* beard */}
    <path d="M 375,89 Q 382,94 389,89" fill="#292524" />
    <ellipse cx="376" cy="85" rx="1.8" ry="2" fill="#1C1917" />
    <ellipse cx="388" cy="85" rx="1.8" ry="2" fill="#1C1917" />
    <path d="M 378,92 Q 382,95 386,92" stroke="#1C1917" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    {/* headset */}
    <path d="M 371,82 Q 371,72 382,72 Q 393,72 393,82" stroke="#374151" strokeWidth="2" fill="none" />
    <rect x="368" y="81" width="5" height="5" rx="2" fill="#374151" />
    <rect x="389" y="81" width="5" height="5" rx="2" fill="#374151" />
    <rect x="375" y="90" width="14" height="10" rx="3" fill="#065F46" />

    {/* Floating alert bubbles */}
    <g opacity="0.85">
      <rect x="440" y="50" width="68" height="30" rx="8" fill="#1E293B" stroke="#22C55E" strokeWidth="1.2" />
      <circle cx="453" cy="65" r="5" fill="#22C55E" opacity="0.9" />
      <text x="463" y="62" fontSize="7" fill="#86EFAC" fontWeight="700">GATE A</text>
      <text x="463" y="72" fontSize="6" fill="#4ADE80">Safe • 42%</text>
    </g>
    <g opacity="0.75">
      <rect x="10" y="45" width="68" height="30" rx="8" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.2" />
      <circle cx="23" cy="60" r="5" fill="#F59E0B" opacity="0.9" />
      <text x="33" y="57" fontSize="7" fill="#FCD34D" fontWeight="700">GATE C</text>
      <text x="33" y="67" fontSize="6" fill="#FDE68A">Caution • 71%</text>
    </g>
    <g opacity="0.7">
      <rect x="10" y="100" width="58" height="22" rx="6" fill="#1E293B" stroke="#EF4444" strokeWidth="1.2" />
      <circle cx="21" cy="111" r="4" fill="#EF4444" opacity="0.9" />
      <text x="29" y="108" fontSize="6.5" fill="#FCA5A5" fontWeight="700">ALERT</text>
      <text x="29" y="118" fontSize="5.5" fill="#F87171">Gate B congestion</text>
    </g>
  </svg>
);

// ============================================================
// Volunteer Hero Illustration — Volunteer at Gate Checkpoint
// Small portrait-ish scene: a volunteer with scanner wand, 
// turnstile gate, and small queue — for volunteer dashboard.
// ============================================================
export const VolunteerHeroIllustration: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 280 160" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vol-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#064E3B" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#065F46" stopOpacity="0.05" />
      </linearGradient>
      <linearGradient id="vol-gate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
      <radialGradient id="scan-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
      </radialGradient>
      <filter id="gate-glow">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Background */}
    <rect width="280" height="160" fill="url(#vol-bg)" rx="12" />

    {/* Floor line */}
    <line x1="20" y1="148" x2="260" y2="148" stroke="#1E293B" strokeWidth="2" />
    <ellipse cx="140" cy="155" rx="130" ry="12" fill="#0F172A" opacity="0.3" />

    {/* Gate pillars */}
    <rect x="128" y="58" width="12" height="90" rx="4" fill="url(#vol-gate)" />
    <rect x="170" y="58" width="12" height="90" rx="4" fill="url(#vol-gate)" />
    {/* Gate top bar */}
    <rect x="124" y="54" width="68" height="10" rx="4" fill="#334155" />
    {/* Gate sign */}
    <rect x="130" y="36" width="50" height="18" rx="4" fill="#1D4ED8" />
    <text x="155" y="49" textAnchor="middle" fontSize="7" fill="white" fontWeight="800">GATE A</text>
    {/* Status light */}
    <circle cx="173" cy="43" r="4" fill="#22C55E" filter="url(#gate-glow)" />

    {/* Scan beam between pillars */}
    <rect x="140" y="65" width="30" height="70" rx="2" fill="url(#scan-glow)" opacity="0.3" />
    <line x1="140" y1="100" x2="170" y2="100" stroke="#22C55E" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.8">
      <animate attributeName="y1" values="65;130;65" dur="2.5s" repeatCount="indefinite" />
      <animate attributeName="y2" values="65;130;65" dur="2.5s" repeatCount="indefinite" />
    </line>
    {/* Checkmark above gate */}
    <circle cx="155" cy="28" r="10" fill="#22C55E" opacity="0.2" />
    <circle cx="155" cy="28" r="7" fill="#22C55E" />
    <path d="M 150,28 L 153,32 L 161,24" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

    {/* ── Volunteer (left of gate) ── */}
    {/* body - green uniform */}
    <rect x="87" y="92" width="22" height="32" rx="5" fill="#15803D" />
    {/* vest/jacket detail */}
    <rect x="91" y="92" width="14" height="20" rx="3" fill="#166534" />
    {/* badge */}
    <rect x="92" y="95" width="9" height="6" rx="1" fill="#22C55E" opacity="0.8" />
    <text x="96.5" y="100" textAnchor="middle" fontSize="3.5" fill="white" fontWeight="800">ID</text>
    {/* arms */}
    <rect x="77" y="96" width="12" height="7" rx="3" fill="#14532D" />
    <rect x="107" y="94" width="14" height="7" rx="3" fill="#14532D" transform="rotate(-20 114 97)" />
    {/* scanner wand (right arm extended) */}
    <rect x="118" y="90" width="6" height="22" rx="3" fill="#374151" transform="rotate(30 121 101)" />
    <circle cx="126" cy="82" r="5" fill="#374151" />
    <circle cx="126" cy="82" r="3" fill="#22C55E" opacity="0.9" />
    {/* head */}
    <ellipse cx="98" cy="84" rx="11" ry="11.5" fill="#92400E" />
    {/* hair */}
    <ellipse cx="98" cy="77" rx="10" ry="5.5" fill="#1C1917" />
    {/* eyes */}
    <ellipse cx="93.5" cy="85" rx="1.8" ry="2" fill="#1C1917" />
    <ellipse cx="102.5" cy="85" rx="1.8" ry="2" fill="#1C1917" />
    {/* beard / mustache */}
    <path d="M 93,92 Q 98,96 103,92" fill="#292524" />
    {/* safety cap */}
    <path d="M 87,80 Q 98,70 109,80" fill="#FBBF24" />
    <rect x="86" y="79" width="24" height="4" rx="2" fill="#F59E0B" />
    {/* "SECURITY" text on cap */}

    {/* ── Attendee entering (between pillars) ── */}
    <rect x="143" y="100" width="16" height="26" rx="4" fill="#BE185D" />
    <rect x="143" y="100" width="16" height="14" rx="3" fill="#9D174D" />
    <ellipse cx="151" cy="93" rx="8.5" ry="9" fill="#92400E" />
    <ellipse cx="151" cy="87" rx="7.5" ry="4.5" fill="#1C1917" />
    {/* dupatta */}
    <path d="M 140,103 Q 148,108 143,120" stroke="#EC4899" strokeWidth="3" fill="none" strokeLinecap="round" />
    {/* bindi */}
    <circle cx="151" cy="91.5" r="1.5" fill="#EF4444" />
    {/* phone with QR */}
    <rect x="139" y="106" width="10" height="12" rx="2" fill="#1E293B" stroke="#22C55E" strokeWidth="1" />
    <rect x="141" y="108" width="6" height="6" rx="1" fill="#22C55E" opacity="0.7" />
    <text x="144" y="114" textAnchor="middle" fontSize="3" fill="#0F172A">QR</text>

    {/* ── Queue (right side, 2 people) ── */}
    {/* Person 4 (blue kurta) */}
    <rect x="196" y="100" width="18" height="28" rx="4" fill="#1D4ED8" />
    <rect x="199" y="100" width="12" height="16" rx="3" fill="#1E40AF" />
    <ellipse cx="205" cy="93" rx="9" ry="9.5" fill="#78350F" />
    <ellipse cx="205" cy="87" rx="8" ry="5" fill="#1C1917" />
    <rect x="196" y="93" width="5" height="9" rx="2" fill="#1E40AF" />
    <rect x="209" y="93" width="5" height="9" rx="2" fill="#1E40AF" />

    {/* Person 5 (orange kurta) */}
    <rect x="224" y="104" width="16" height="24" rx="4" fill="#C2410C" />
    <rect x="227" y="104" width="10" height="14" rx="3" fill="#9A3412" />
    <ellipse cx="232" cy="97" rx="8.5" ry="9" fill="#92400E" />
    <ellipse cx="232" cy="91" rx="7.5" ry="4.5" fill="#292524" />
    <rect x="224" y="97" width="5" height="8" rx="2" fill="#9A3412" />
    <rect x="235" y="97" width="5" height="8" rx="2" fill="#9A3412" />

    {/* Stanchion rope between queue */}
    <rect x="189" y="118" width="5" height="30" rx="2" fill="#94A3B8" />
    <circle cx="191.5" cy="118" r="4" fill="#CBD5E1" />
    <rect x="222" y="118" width="5" height="30" rx="2" fill="#94A3B8" />
    <circle cx="224.5" cy="118" r="4" fill="#CBD5E1" />
    <path d="M 191,122 Q 208,128 224,122" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />

    {/* Floating "Scan OK" toast */}
    <g>
      <rect x="186" y="52" width="68" height="24" rx="7" fill="#052e16" stroke="#22C55E" strokeWidth="1.2" />
      <circle cx="199" cy="64" r="5" fill="#22C55E" />
      <path d="M 196,64 L 198,67 L 203,60" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="208" y="61" fontSize="6.5" fill="#86EFAC" fontWeight="700">Scan OK</text>
      <text x="208" y="72" fontSize="5.5" fill="#4ADE80">Entry approved!</text>
    </g>
  </svg>
);
