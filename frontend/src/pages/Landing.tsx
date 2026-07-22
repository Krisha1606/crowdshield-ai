import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  Users,
  Award,
  Shield,
  Calendar,
  AlertTriangle,
  Mail,
  Building,
  CheckCircle2,
  Lock,
  Globe,
  Clock,
  Compass,
  Trophy,
  Music,
  Briefcase,
  Bell,
  Check,
  Info
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { 
  VenueIllustration,
  SmartGateIllustration,
  VolunteersIllustration,
  RiskMonitoringIllustration,
  IncidentManagementIllustration,
  AnalyticsIllustration,
  QueueIntelligenceIllustration,
  CrowdShieldScene,
  SectorMapIllustration
} from '../components/CrowdShieldIllustrations';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  // Interactive State for Solutions Tabs
  const [activeTab, setActiveTab] = useState<'stadiums' | 'festivals' | 'conferences' | 'venues'>('stadiums');
  const [zoomedIllustration, setZoomedIllustration] = useState<'risk' | 'volunteers' | 'analytics' | 'map' | null>(null);
  
  // Contact Form State
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [eventRole, setEventRole] = useState('Safety Coordinator');
  const [message, setMessage] = useState('');

  // Scroll Header & Parallax Background Effect
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Active Navigation Section Tracking
  const [activeSection, setActiveSection] = useState('hero');
  useEffect(() => {
    const sections = ['hero', 'features', 'solutions', 'about', 'contact'];
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -40% 0px',
      threshold: 0
    };

    const observers = sections.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setActiveSection(id);
        }
      }, observerOptions);
      observer.observe(el);
      return { observer, el };
    });

    return () => {
      observers.forEach(obs => {
        if (obs) obs.observer.unobserve(obs.el);
      });
    };
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      setFormSubmitted(true);
      setTimeout(() => {
        setFormSubmitted(false);
        setName('');
        setEmail('');
        setMessage('');
      }, 4000);
    }
  };

  // Checklist items simulation
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Calibrate Entrance scan cameras', completed: true },
    { id: 2, text: 'Confirm volunteer radio frequencies', completed: true },
    { id: 3, text: 'Inspect Gate B turnstile telemetry', completed: false },
    { id: 4, text: 'Sync FastAPI Risk model endpoints', completed: false }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setChecklist(prev => 
        prev.map(item => 
          item.id === 3 ? { ...item, completed: !item.completed } : 
          item.id === 4 ? { ...item, completed: !item.completed } : item
        )
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Dispatch alerts ticker simulation
  const [activeAlerts, setActiveAlerts] = useState([
    { id: 1, type: 'critical', location: 'Sector B', message: 'Crowd density threshold exceeded', time: 'Just Now' },
    { id: 2, type: 'warning', location: 'Main Entrance', message: 'Additional staff deployed', time: '3m ago' },
    { id: 3, type: 'resolved', location: 'North Gate', message: 'Access route cleared', time: '12m ago' }
  ]);

  const solutions = {
    stadiums: {
      title: "Stadiums & Arenas",
      icon: Trophy,
      accent: "text-blue-500 bg-blue-500/10 border-blue-500/20 dark:border-blue-500/40",
      description: "Optimize crowd movement, security operations, and venue access during large-scale events. Gain actionable insights that improve attendee experiences while reducing congestion and operational delays.",
      features: [
        "Crowd Flow Forecasting",
        "Dynamic Volunteer Allocation",
        "Emergency Response Monitoring",
        "Real-Time Operational Visibility"
      ],
      stat: "22% Operational Delay Reduction",
      gradient: "from-blue-600/10 to-blue-600/5 dark:from-blue-950/20 dark:to-blue-950/5"
    },
    festivals: {
      title: "Festivals & Concerts",
      icon: Music,
      accent: "text-slate-500 bg-slate-500/10 border-slate-500/20 dark:border-slate-500/40",
      description: "Coordinate safety and logistics programs across open, large-scale outdoor venues. Maintain continuous dispatcher logs, coordinate volunteer shifts, and report field incidents instantly.",
      features: [
        "Mobile-First Volunteer Checkpoint Cards",
        "Instant Incident Reporting & Dispatching",
        "Crowd Density & Flow Variance Alerts",
        "Emergency Alerts Broadcast to all Staff Nodes"
      ],
      stat: "4.8x Incident Prevention Speed",
      gradient: "from-slate-600/10 to-slate-600/5 dark:from-slate-950/20 dark:to-slate-950/5"
    },
    conferences: {
      title: "Conferences & Expos",
      icon: Briefcase,
      accent: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/40",
      description: "Streamline high-velocity attendee registration and check-in workflows. Track badge scanner throughput, manage foyer queues, and optimize attendee flow throughout the venue.",
      features: [
        "Real-Time Badge Scanner Analytics",
        "Estimated Queue Wait Times for Logistics Team",
        "Volunteer Roster Management & Hour Tracking",
        "Interactive Event Attendance Trend Graphs"
      ],
      stat: "99.2% Registrant Satisfaction",
      gradient: "from-indigo-600/10 to-indigo-600/5 dark:from-indigo-950/20 dark:to-indigo-950/5"
    },
    venues: {
      title: "Smart Venues & Hubs",
      icon: Globe,
      accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/40",
      description: "Establish permanent AI safety monitoring nodes for stadiums, arenas, and transit centers. Maintain persistent data pipelines, log safety parameters, and audit historical ingress performance.",
      features: [
        "Continuous Real-Time Data Synchronization",
        "Automated Risk Scoring & Alert Generation",
        "PostgreSQL Telemetry Audit Logging",
        "API Integrations for External Operations Dashboards"
      ],
      stat: "100% Safety Compliance Index",
      gradient: "from-emerald-600/10 to-emerald-600/5 dark:from-emerald-950/20 dark:to-emerald-950/5"
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors duration-500 flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Scroll-Reactive Premium Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
        {/* Rotating grid coordinates */}
        <div 
          className="absolute w-[200vw] h-[200vh] top-[-50vh] left-[-50vw] opacity-[0.02] dark:opacity-[0.035] transition-transform duration-300 ease-out"
          style={{ 
            transform: `rotate(${scrollY * 0.03}deg)`, 
            backgroundImage: 'radial-gradient(circle, var(--text-primary) 1.2px, transparent 1.2px)',
            backgroundSize: '48px 48px'
          }} 
        />
        
        {/* Rotating network concentric rings SVG */}
        <svg 
          className="absolute w-[140vw] h-[140vh] top-[-20vh] left-[-20vw] opacity-[0.03] dark:opacity-[0.06] text-app-text transition-transform duration-500 ease-out"
          style={{ transform: `rotate(${scrollY * -0.04}deg) scale(1.05)` }}
          viewBox="0 0 1000 1000"
          fill="none"
        >
          <circle cx="500" cy="500" r="450" stroke="currentColor" strokeWidth="1" strokeDasharray="6 12" />
          <circle cx="500" cy="500" r="350" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="500" cy="500" r="230" stroke="currentColor" strokeWidth="1" strokeDasharray="8 16" />
          <circle cx="500" cy="500" r="120" stroke="currentColor" strokeWidth="1.5" />
          
          <line x1="500" y1="50" x2="500" y2="950" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 8" />
          <line x1="50" y1="500" x2="950" y2="500" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 8" />
          <line x1="182" y1="182" x2="818" y2="818" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" />
          <line x1="182" y1="818" x2="818" y2="182" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" />
        </svg>

        {/* Ambient glow layers with parallax displacement */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full bg-blue-600/5 dark:bg-blue-600/10 blur-3xl transition-transform duration-100 ease-out"
          style={{ transform: `translate3d(60vw, ${-100 + scrollY * 0.08}px, 0)` }}
        />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full bg-slate-500/4 dark:bg-slate-600/4 blur-3xl transition-transform duration-150 ease-out"
          style={{ transform: `translate3d(-20vw, ${300 + scrollY * -0.12}px, 0)` }}
        />
        <div 
          className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/3 dark:bg-blue-600/6 blur-3xl transition-transform duration-100 ease-out"
          style={{ transform: `translate3d(70vw, ${800 + scrollY * 0.05}px, 0)` }}
        />
      </div>

      {/* 1. Glassmorphic Navigation Bar */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'py-2.5 bg-app-navbar/80 backdrop-blur-md border-b border-app-card-border shadow-depth-2' 
          : 'py-3 bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-premium rounded-xl shadow-depth-1">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-outfit text-xl font-black tracking-tight text-[#111827] dark:text-[#F8FAFC]">
              CrowdShield <span className="text-[10px] px-2 py-0.5 rounded border font-bold text-[#2563EB] bg-[#2563EB]/10 border-[#2563EB]/20 dark:text-[#4F7EFF] dark:bg-[#4F7EFF]/10 dark:border-[#4F7EFF]/30">AI</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { id: 'hero', label: 'Home' },
              { id: 'features', label: 'Features' },
              { id: 'solutions', label: 'Solutions' },
              { id: 'about', label: 'Workflow' },
              { id: 'contact', label: 'Contact' }
            ].map(item => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`relative py-1.5 transition-colors duration-200 text-xs font-bold uppercase tracking-widest ${
                    isActive 
                      ? 'text-[#2563EB] dark:text-[#60A5FA]' 
                      : 'text-[#334155] hover:text-[#111827] dark:text-[#CBD5E1] dark:hover:text-[#FFFFFF]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.span 
                      layoutId="activeUnderline" 
                      className="absolute left-0 right-0 bottom-0 h-0.5 bg-[#2563EB] dark:bg-[#60A5FA]" 
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Action Row */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 text-app-text-muted hover:text-app-text hover:bg-slate-850 dark:hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-800 dark:hover:border-slate-800"
              title="Toggle Color Mode"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <Link 
              to="/login" 
              className="hidden sm:inline-block text-xs font-bold uppercase tracking-widest text-app-text-muted hover:text-app-text transition-colors px-4 py-2.5 rounded-xl hover:bg-slate-850 dark:hover:bg-slate-900 border border-transparent hover:border-slate-800 dark:hover:border-slate-800"
            >
              Sign In
            </Link>
            
            <Link 
              to="/dashboard" 
              className="text-xs font-bold uppercase tracking-widest text-white bg-gradient-premium hover:opacity-95 px-5 py-3 rounded-xl transition-all shadow-glow-primary border border-primary/20"
            >
              Operator Panel
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Cinematic Hero Section */}
      <section id="hero" className="relative pt-20 pb-8 md:pt-24 md:pb-10 min-h-[55vh] flex items-center justify-center overflow-hidden">
        {/* CSS Dot-Grid Background — Smart Venue / Security Infrastructure */}
        <div 
          className="absolute inset-0 z-0 overflow-hidden" 
          aria-hidden="true"
          style={{ backdropFilter: 'blur(2px)', opacity: 0.08 }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #94A3B8 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.2) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-app-bg/80 via-transparent to-app-bg/80" />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
          
          {/* Hero Content — 50% column */}
          <div className="lg:col-span-6 flex flex-col justify-center text-center lg:text-left">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-4"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> SECURITY &amp; CROWD INTELLIGENCE
              </span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="mb-3 font-heading"
            >
              <h1 className="font-[800] tracking-[-0.04em] max-w-[620px]" style={{ fontSize: 'clamp(44px,4.2vw,76px)', lineHeight: '1.08' }}>
                <span className="text-[#0F172A] dark:text-[#F8FAFC] block">Real-Time Crowd</span>
                <span className="text-[#0F172A] dark:text-[#F8FAFC] block mb-2">Intelligence</span>
                <span className="text-[#2563EB] dark:text-[#60A5FA] font-bold block">for Modern Venues</span>
              </h1>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-app-text-muted text-[16px] md:text-[17px] leading-[1.6] max-w-[540px] mx-auto lg:mx-0 font-medium mb-6 mt-3"
            >
              CrowdShield AI is an intelligent crowd management platform that leverages AI and predictive analytics to forecast crowd behavior, optimize operations, coordinate response teams, and enhance public safety in real time.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 h-14 text-[13px] font-bold uppercase tracking-widest text-white bg-[#2563EB] rounded-[16px] shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 transition-all"
              >
                <span>Launch Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 h-14 text-[13px] font-bold uppercase tracking-widest text-[#1E293B] dark:text-[#F1F5F9] bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1E293B] rounded-[16px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all"
              >
                <span>Explore Features</span>
              </a>
            </motion.div>
          </div>

          {/* Hero Visualization — 50% column */}
          <div className="lg:col-span-6 w-full flex items-center justify-center lg:justify-end mt-10 lg:mt-0">
            <div className="w-full max-w-[500px] select-none pointer-events-none">
              <CrowdShieldScene className="w-full h-auto" />
            </div>
          </div>

        </div>
      </section>

      {/* 3. Risk Prediction Section (Asymmetric Editorial) */}
      <section id="features" className="py-24 border-t border-app-card-border bg-slate-50/20 dark:bg-slate-950/10 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Storytelling & Headers */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-extrabold text-primary uppercase tracking-widest block">AI-Powered Risk Analysis</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-app-text leading-tight">
                <span className="block text-primary">Anticipate Hazards</span>
                <span className="font-heading font-black uppercase tracking-tight block text-2xl sm:text-4xl text-app-text mt-1">Before They Form</span>
              </h2>
              <p className="text-app-text-muted text-sm leading-relaxed font-medium">
                CrowdShield AI continuously analyzes crowd movement, occupancy levels, and operational patterns to identify emerging risks before they impact venue safety. Predictive intelligence helps teams make proactive decisions and maintain smooth crowd flow.
              </p>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-app-card/60 border border-app-card-border/80 shadow-depth-1">
                  <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Dynamic Queue Monitoring</h4>
                    <p className="text-xs text-app-text-muted mt-0.5">Detects developing congestion patterns and operational bottlenecks across venue entry points.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-app-card/60 border border-app-card-border/80 shadow-depth-1">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Predictive Risk Intelligence</h4>
                    <p className="text-xs text-app-text-muted mt-0.5">Applies machine learning models to forecast crowd conditions and support faster decision-making.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Layered Collage */}
            <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end min-h-[380px]">
              
              {/* Large Background Graphic Collage */}
              <div 
                onClick={() => setZoomedIllustration('risk')}
                className="w-full max-w-[480px] h-[320px] rounded-3xl overflow-hidden border border-app-card-border bg-[#0B0F19] shadow-depth-2 relative group flex items-center justify-center p-0 cursor-zoom-in transition-all duration-300 hover:shadow-depth-3 hover:border-primary/30"
              >
                <RiskMonitoringIllustration className="w-full h-full group-hover:scale-[1.02] transition-transform duration-700" />
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 4. Volunteer Management Section (Human-centered & Checklist animations) */}
      <section className="py-24 border-t border-app-card-border bg-app-bg relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Graphic collage */}
            <div className="lg:col-span-6 order-2 lg:order-1 relative flex items-center justify-center lg:justify-start min-h-[380px]">
              
              {/* Collage base container */}
              <div 
                onClick={() => setZoomedIllustration('volunteers')}
                className="w-full max-w-[480px] h-[320px] rounded-3xl overflow-hidden border border-app-card-border bg-[#F8FAFC] dark:bg-[#0B0F19] shadow-depth-2 relative group flex items-center justify-center p-2 cursor-zoom-in transition-all duration-300 hover:shadow-depth-3 hover:border-primary/30"
              >
                <VolunteersIllustration className="w-full h-full group-hover:scale-[1.02] transition-transform duration-700" />
              </div>

            </div>

            {/* Right Column: Editorial Details */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
              <span className="text-xs font-extrabold text-accent uppercase tracking-widest block">Roster Coordination</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-app-text leading-tight">
                <span className="block text-accent">Empower Volunteers</span>
                <span className="font-heading font-black uppercase tracking-tight block text-2xl sm:text-4xl text-app-text mt-1">With Live Roster Cards</span>
              </h2>
              <p className="text-app-text-muted text-sm leading-relaxed font-medium">
                Coordinate volunteers and operational teams through a unified workforce management system. Assign responsibilities, monitor task completion, and maintain real-time visibility across venue operations.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-xl bg-app-card border border-app-card-border/80 shadow-depth-1">
                  <span className="text-2xl font-black font-outfit text-primary block">12s</span>
                  <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider block mt-1">Average Response Time</span>
                </div>

                <div className="p-4 rounded-xl bg-app-card border border-app-card-border/80 shadow-depth-1">
                  <span className="text-2xl font-black font-outfit text-accent block">99.8%</span>
                  <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider block mt-1">Task Compliance Rate</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Solutions Sectors Tab Section (Editorial Switcher) */}
      <section id="solutions" className="py-24 border-t border-app-card-border bg-slate-50/20 dark:bg-slate-950/10 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          
          <div className="text-center mb-16 space-y-4">
            <span className="text-xs font-extrabold text-accent uppercase tracking-widest block">Sector Showcase</span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              <span className="text-app-text">Designed for</span> <span className="font-heading font-black uppercase tracking-tight text-2xl sm:text-4xl text-primary">Live Venues &amp; Crowds</span>
            </h2>
            <p className="text-app-text-muted text-sm max-w-xl mx-auto font-medium">Purpose-built for high-capacity environments where safety, efficiency, and coordination are essential. Adapt CrowdShield AI to match the operational requirements of any venue.</p>
          </div>

          {/* Solutions Switcher Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {(Object.keys(solutions) as Array<keyof typeof solutions>).map((key) => {
              const sol = solutions[key];
              const Icon = sol.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    isActive 
                      ? 'bg-gradient-premium text-white border-primary shadow-glow-primary' 
                      : 'bg-app-card/60 text-app-text-muted border-app-card-border hover:bg-app-card hover:text-app-text'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{sol.title}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className={`p-8 md:p-10 rounded-[32px] border border-app-card-border/80 bg-gradient-to-br ${solutions[activeTab].gradient} backdrop-blur-md shadow-depth-3 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative overflow-hidden`}
            >
              {/* Glowing aura */}
              <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

              <div className="lg:col-span-7 space-y-6 relative z-10">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${solutions[activeTab].accent}`}>
                  {solutions[activeTab].stat}
                </span>
                
                <h3 className="text-3xl font-black font-outfit uppercase tracking-tight">{solutions[activeTab].title} Safety</h3>
                <p className="text-app-text-muted text-sm font-medium leading-relaxed">{solutions[activeTab].description}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5 pt-2">
                  {solutions[activeTab].features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs font-bold">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic SVG Mockup representation */}
              <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-950/60 dark:bg-slate-950/30 border border-slate-900/80 dark:border-slate-800/40 flex items-center justify-center min-h-[240px] relative z-10 shadow-depth-2">
                {activeTab === 'stadiums' && <VenueIllustration className="w-full max-w-[260px] h-auto" />}
                {activeTab === 'festivals' && <VolunteersIllustration className="w-full max-w-[260px] h-auto" />}
                {activeTab === 'conferences' && <SmartGateIllustration className="w-full max-w-[260px] h-auto" />}
                {activeTab === 'venues' && <RiskMonitoringIllustration className="w-full max-w-[260px] h-auto" />}
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </section>

      {/* 6. Interactive Analytics Section (Glassmorphic dashboard collage) */}
      <section className="py-24 border-t border-app-card-border bg-app-bg relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Glassmorphic panel with chart */}
            <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-start min-h-[380px]">
              
              {/* Main glass panel */}
              <div 
                onClick={() => setZoomedIllustration('analytics')}
                className="w-full max-w-[480px] h-[320px] rounded-3xl overflow-hidden border border-app-card-border bg-[#0B0F19] shadow-depth-2 relative group flex items-center justify-center p-0 cursor-zoom-in transition-all duration-300 hover:shadow-depth-3 hover:border-primary/30"
              >
                <AnalyticsIllustration className="w-full h-full" />
              </div>

            </div>

            {/* Right Column: Editorial copy */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-extrabold text-primary uppercase tracking-widest block">Metrics &amp; Database logging</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-app-text leading-tight">
                <span className="block text-primary">Real-Time Ingress</span>
                <span className="font-heading font-black uppercase tracking-tight block text-2xl sm:text-4xl text-app-text mt-1">Trend Dashboards</span>
              </h2>
              <p className="text-app-text-muted text-sm leading-relaxed font-medium">
                Monitor venue performance through centralized operational intelligence. Analyze crowd trends, staffing efficiency, safety indicators, and event activity from a single dashboard.
              </p>
              
              <div className="pt-4 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Interactive Trend Analysis</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Operational Audit Logging</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Compliance Reporting</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Performance Insights</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. Incident Response Section (Emergency dispatch feel) */}
      <section className="py-24 border-t border-app-card-border bg-slate-50/20 dark:bg-slate-950/10 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Editorial explanation */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-extrabold text-accent uppercase tracking-widest block">Response Coordination</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-app-text leading-tight">
                <span className="block text-accent">Incident Control</span>
                <span className="font-heading font-black uppercase tracking-tight block text-2xl sm:text-4xl text-app-text mt-1">Active Dispatch Center</span>
              </h2>
              <p className="text-app-text-muted text-sm leading-relaxed font-medium">
                Respond to incidents faster with a centralized command environment that delivers real-time alerts, operational updates, and coordinated response workflows across teams and venue sectors.
              </p>
              
              {/* Alert ticker feed simulation */}
              <div className="space-y-3.5 pt-4">
                <h4 className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">Active Operations Dispatch Log</h4>
                <div className="space-y-2">
                  {activeAlerts.map(alert => (
                    <div key={alert.id} className="p-3.5 rounded-xl bg-app-card border border-app-card-border/80 flex items-center justify-between shadow-depth-1">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          alert.type === 'critical' ? 'bg-red-500 animate-pulse' :
                          alert.type === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'
                        }`} />
                        <div>
                          <p className="text-xs font-bold text-app-text">{alert.message}</p>
                          <span className="text-[10px] text-app-text-muted">{alert.location}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-app-text-muted">{alert.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: High fidelity dispatch dashboard */}
            <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end min-h-[380px]">
              
              {/* Main visual wrapper */}
              <div 
                onClick={() => setZoomedIllustration('map')}
                className="w-full max-w-[480px] h-[320px] rounded-3xl overflow-hidden border border-app-card-border bg-[#050914] shadow-depth-2 relative group flex items-center justify-center p-0 cursor-zoom-in transition-all duration-300 hover:shadow-depth-3 hover:border-primary/30"
              >
                <SectorMapIllustration className="w-full h-full group-hover:scale-[1.02] transition-transform duration-700" />
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 8. Technical Pipeline Step Section */}
      <section id="about" className="py-24 border-t border-app-card-border bg-app-bg relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          
          <div className="text-center mb-16 space-y-4">
            <span className="text-xs font-extrabold text-primary uppercase tracking-widest block">Deployment Pipeline</span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-app-text">
              <span className="text-app-text">How CrowdShield AI</span> <span className="font-heading font-black uppercase tracking-tight text-2xl sm:text-4xl text-primary">Operates</span>
            </h2>
            <p className="text-app-text-muted text-sm max-w-xl mx-auto font-medium">A secure and intelligent operational workflow that transforms live venue data into actionable insights and coordinated response decisions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="p-7 rounded-[24px] bg-app-card border border-app-card-border shadow-depth-2 flex flex-col justify-between h-64 hover:-translate-y-1.5 transition-all duration-300 group">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-sm font-outfit">
                01
              </div>
              <div className="space-y-2">
                <h4 className="font-outfit text-lg font-black uppercase tracking-tight">Live Data Collection</h4>
                <p className="text-xs text-app-text-muted font-semibold leading-relaxed">Attendance metrics, crowd density signals, operational events, and venue activity are collected continuously from connected systems.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-7 rounded-[24px] bg-app-card border border-app-card-border shadow-depth-2 flex flex-col justify-between h-64 hover:-translate-y-1.5 transition-all duration-300 group">
              <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-black text-sm font-outfit">
                02
              </div>
              <div className="space-y-2">
                <h4 className="font-outfit text-lg font-black uppercase tracking-tight">AI-Powered Analysis</h4>
                <p className="text-xs text-app-text-muted font-semibold leading-relaxed">Machine learning models evaluate operational conditions, identify patterns, and generate predictive risk assessments in real time.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-7 rounded-[24px] bg-app-card border border-app-card-border shadow-depth-2 flex flex-col justify-between h-64 hover:-translate-y-1.5 transition-all duration-300 group">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-black text-sm font-outfit">
                03
              </div>
              <div className="space-y-2">
                <h4 className="font-outfit text-lg font-black uppercase tracking-tight">Coordinated Response</h4>
                <p className="text-xs text-app-text-muted font-semibold leading-relaxed">Actionable insights are delivered to operators and field teams, enabling faster decisions and more effective crowd management.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 9. Exclusive Contact Inquiry Section */}
      <section id="contact" className="py-24 border-t border-app-card-border bg-slate-50/20 dark:bg-slate-950/10 relative z-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="p-8 md:p-14 rounded-[36px] glass-premium border border-app-glass-border/40 relative overflow-hidden shadow-depth-3">
            
            {/* Ambient glows inside contact card */}
            <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-4 relative z-10">
              <span className="text-xs font-bold text-primary uppercase tracking-widest block">Inquire Access</span>
              <h2 className="text-4xl font-bold tracking-tight text-app-text">
                <span className="text-app-text">Request a</span> <span className="font-heading font-black uppercase tracking-tight text-2xl sm:text-4xl text-primary">CrowdShield Demo</span>
              </h2>
              <p className="text-app-text-muted text-xs font-semibold leading-relaxed">
                Discover how CrowdShield AI can help your organization improve crowd safety, streamline operations, and gain real-time visibility across venues and events.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6 relative z-10">
              <AnimatePresence mode="wait">
                {formSubmitted ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 dark:text-emerald-400 text-center space-y-3 shadow-depth-2"
                  >
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 animate-bounce" />
                    <h4 className="font-black text-base font-outfit uppercase tracking-wider">Demo Consultation Initialized</h4>
                    <p className="text-xs font-semibold opacity-90">Thank you! Our operations team will contact you at {email} within 24 hours.</p>
                  </motion.div>
                ) : (
                  <motion.div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest">Full Name</label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Marcus Hall"
                          className="w-full px-5.5 py-4 text-xs bg-slate-950/60 dark:bg-slate-950/40 focus:bg-slate-950 focus:dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 focus:border-primary focus:outline-none rounded-xl text-app-text font-semibold transition-all shadow-depth-1"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest">Business Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. hall@metrocenter.org"
                          className="w-full px-5.5 py-4 text-xs bg-slate-950/60 dark:bg-slate-950/40 focus:bg-slate-950 focus:dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 focus:border-primary focus:outline-none rounded-xl text-app-text font-semibold transition-all shadow-depth-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest">Operations Coordinator Role</label>
                      <select
                        value={eventRole}
                        onChange={(e) => setEventRole(e.target.value)}
                        className="w-full px-5.5 py-4 text-xs bg-slate-950/60 dark:bg-slate-950/40 focus:bg-slate-950 focus:dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 focus:border-primary focus:outline-none rounded-xl text-app-text font-semibold transition-all shadow-depth-1"
                      >
                        <option value="Safety Coordinator">Safety &amp; Security Director</option>
                        <option value="Operations Manager">Event Operations Manager</option>
                        <option value="Logistics Roster">Logistics Coordinator</option>
                        <option value="Roster Volunteer">Roster Volunteer Operator</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest">Message</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Tell us about your venue, expected attendance, operational challenges, and crowd management requirements."
                        className="w-full px-5.5 py-4 text-xs bg-slate-950/60 dark:bg-slate-950/40 focus:bg-slate-950 focus:dark:bg-slate-950 border border-slate-800 dark:border-slate-800/80 focus:border-primary focus:outline-none rounded-xl text-app-text font-semibold transition-all resize-none shadow-depth-1"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4.5 mt-3 text-xs font-bold uppercase tracking-wider text-white bg-gradient-premium hover:opacity-95 rounded-xl transition-all shadow-glow-primary border border-primary/20"
                    >
                      Submit Consultation Request
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </section>

      {/* 10. Editorial Footer */}
      <footer className="mt-auto border-t border-app-card-border bg-app-card py-10 md:py-12 text-xs font-semibold text-app-text-muted relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 bg-gradient-premium rounded-lg shadow-depth-1">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-outfit text-app-text text-lg font-black tracking-tight">CrowdShield AI</span>
            </div>
            <p className="max-w-xs text-xs font-medium leading-relaxed">
              CrowdShield AI delivers intelligent crowd operations, predictive risk monitoring, and real-time coordination tools designed for modern venues, events, and public spaces.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-extrabold text-app-text uppercase tracking-widest block">Platform</span>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
              <li><a href="#solutions" className="hover:text-primary transition-colors">Solutions</a></li>
              <li><Link to="/dashboard" className="hover:text-primary transition-colors">Operator Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-extrabold text-app-text uppercase tracking-widest block">Compliance</span>
            <ul className="space-y-2 text-xs">
              <li><a href="#privacy" className="hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); alert('Privacy statements handled by security at compliance@crowdshield.ai'); }}>Privacy Statement</a></li>
              <li><a href="#terms" className="hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); alert('Terms of agreement handled by legal at compliance@crowdshield.ai'); }}>Terms of Service</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-extrabold text-app-text uppercase tracking-widest block">Developer</span>
            <ul className="space-y-2 text-xs">
              <li><a href="mailto:operations@crowdshield.ai" className="hover:text-primary transition-colors">Contact Support</a></li>
              <li><a href="#docs" className="hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); alert('API endpoints available under FastAPI /docs router.'); }}>API Docs</a></li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-6 border-t border-app-card-border/60 pt-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-app-text-muted">© {new Date().getFullYear()} CrowdShield AI. Designed for premium SaaS safety presentations.</p>
          <div className="flex items-center gap-6 text-xs text-app-text-muted">
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">LinkedIn</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

      {/* Premium Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {zoomedIllustration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedIllustration(null)}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 cursor-zoom-out"
          >
            {/* Close Button */}
            <button
              onClick={() => setZoomedIllustration(null)}
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 hover:scale-105 cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content Container */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl aspect-[4/3] max-h-[75vh] flex items-center justify-center p-6 bg-slate-900/60 dark:bg-slate-900/30 border border-white/5 rounded-3xl shadow-2xl relative"
            >
              {zoomedIllustration === 'risk' && <RiskMonitoringIllustration className="w-full h-full object-contain" />}
              {zoomedIllustration === 'volunteers' && <VolunteersIllustration className="w-full h-full object-contain" />}
              {zoomedIllustration === 'analytics' && <AnalyticsIllustration className="w-full h-full object-contain" />}
              {zoomedIllustration === 'map' && <SectorMapIllustration className="w-full h-full object-contain" />}
            </motion.div>

            {/* Caption */}
            <div className="text-center mt-6 max-w-xl px-4 pointer-events-none select-none">
              <h3 className="text-white text-xl font-bold uppercase tracking-wider font-outfit">
                {zoomedIllustration === 'risk' && 'AI Risk Forecasting Telemetry'}
                {zoomedIllustration === 'volunteers' && 'Volunteer Staffing & Roster Coordination'}
                {zoomedIllustration === 'analytics' && 'Ingress Dynamics Flow Chart'}
                {zoomedIllustration === 'map' && 'Active Dispatch Center Map'}
              </h3>
              <p className="text-slate-400 text-xs mt-2 font-medium">
                {zoomedIllustration === 'risk' && 'Dynamic Random Forest classification of congestion points and safety parameters.'}
                {zoomedIllustration === 'volunteers' && 'Real-time synchronization of shift tasks, volunteer positions, and status checkpoints.'}
                {zoomedIllustration === 'analytics' && 'Real-time charting of scan velocity, wait times, and active occupancy rates.'}
                {zoomedIllustration === 'map' && 'Live operational visualization showing staff dispatch routes, active incidents, and response times.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Landing;
