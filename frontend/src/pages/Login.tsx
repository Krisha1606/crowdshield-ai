import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, AlertCircle, Eye, EyeOff, Sparkles, Shield, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { LoginCartoonIllustration } from '../components/CrowdShieldIllustrations';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'volunteer'>('admin');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/login', {
        username: username.trim(),
        password: password.trim()
      });

      const { access_token, user } = response.data;

      // Verify that the user role matches the selected login role
      if (user.role !== role) {
        setError(`Access denied. The account does not have ${role} privileges.`);
        setIsLoading(false);
        return;
      }

      login(access_token, user);
      
      if (rememberMe) {
        localStorage.setItem('crowdshield_remember_user', username);
      } else {
        localStorage.removeItem('crowdshield_remember_user');
      }

      if (user.role === 'volunteer') {
        navigate('/volunteer/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Connection failed. Please check if the FastAPI server is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-slate-950 text-slate-100 flex flex-col lg:flex-row transition-colors duration-300 relative">
      
      {/* Full-Screen Background Widescreen Waves */}
      <svg viewBox="0 0 1440 900" fill="none" className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-95" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg-fade-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--slate-950)" stopOpacity="0.95" />
            <stop offset="65%" stopColor="var(--slate-950)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--slate-950)" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="blob-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="spotlight-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Full canvas background gradient */}
        <rect width="1440" height="900" fill="url(#bg-fade-grad)" />
        
        {/* Seamless Widescreen Waves spanning horizontally across the whole page */}
        <path d="M 0,100 C 400,0 800,250 1440,80 L 1440,900 L 0,900 Z" fill="url(#blob-grad)" opacity="0.45" />
        <path d="M 0,220 C 450,100 900,360 1440,160 L 1440,900 L 0,900 Z" fill="url(#blob-grad)" opacity="0.75" />
        <path d="M 0,340 C 500,200 950,480 1440,260 L 1440,900 L 0,900 Z" fill="url(#blob-grad)" />

        {/* Spotlight Beams */}
        <polygon points="150,900 0,0 450,0" fill="url(#spotlight-grad)" />
        <polygon points="1290,900 990,0 1440,0" fill="url(#spotlight-grad)" />
      </svg>

      {/* Background glow spots */}
      <div className="absolute top-10 left-10 w-96 h-96 rounded-full bg-purple-600/5 dark:bg-purple-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] rounded-full bg-blue-600/5 dark:bg-blue-600/10 blur-[130px] pointer-events-none" />
 
      {/* Left Column: Renders the cartoon illustration on the left half of the screen */}
      <div className="hidden lg:flex lg:w-6/12 flex-col justify-between bg-transparent relative overflow-hidden select-none">
        
        {/* Brand Header at top-left of Left Column */}
        <div className="absolute top-8 left-8 flex items-center gap-2 cursor-pointer z-20 pointer-events-auto" onClick={() => navigate('/')}>
          <img src="/src/assets/logo.svg" alt="CrowdShield Logo" className="w-8 h-8" />
          <span className="font-outfit text-lg font-extrabold tracking-tight text-slate-100">
            CrowdShield <span className="text-primary text-[10px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">AI</span>
          </span>
        </div>

        <div className="w-full h-full flex items-center justify-center pointer-events-none">
          <LoginCartoonIllustration className="w-full h-full object-contain opacity-95 p-8" />
        </div>
        
        {/* Subtle overlay gradient to ensure high readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/20 pointer-events-none" />
      </div>

      {/* Right Column: Glass Card Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10 lg:h-full lg:overflow-y-auto">

        {/* Brand Header centered above Card - Hidden on Desktop since it is in the top-left */}
        <div className="lg:hidden flex flex-col items-center mb-8 cursor-pointer relative z-10" onClick={() => navigate('/')}>
          <div className="flex items-center gap-2 mb-3">
            <img src="/src/assets/logo.svg" alt="CrowdShield Logo" className="w-9 h-9" />
            <span className="font-outfit text-xl font-extrabold tracking-tight text-slate-100">
              CrowdShield <span className="text-primary text-xs bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">AI</span>
            </span>
          </div>
        </div>

        {/* Main Login Form Card - Always glass-premium for gorgeous contrast */}
        <div className="w-full max-w-md px-8 py-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md relative">
          
          {/* Back to Website Link */}
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Website</span>
          </Link>
          
          <div className="mb-5">
            <h2 className="font-outfit text-xl font-black text-slate-100 mb-0.5 flex items-center gap-2">
              <Shield className="w-5.5 h-5.5 text-primary" />
              <span>Access Command Center</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold">Verify your credentials to authenticate and manage gates.</p>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-850 mb-4">
            <button
              type="button"
              onClick={() => { setRole('admin'); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                role === 'admin' 
                  ? 'bg-gradient-premium text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Administrator
            </button>
            <button
              type="button"
              onClick={() => { setRole('volunteer'); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                role === 'volunteer' 
                  ? 'bg-gradient-premium text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Volunteer Staff
            </button>
          </div>

          {/* Error notification banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-semibold mb-4 animate-pulse">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950/80 hover:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-slate-100 placeholder-slate-500 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-950/80 hover:bg-slate-950 border border-slate-850 focus:border-primary focus:outline-none rounded-xl text-slate-100 placeholder-slate-500 transition-all font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between text-xs font-semibold pt-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 text-primary focus:ring-0 focus:ring-offset-0 bg-slate-950"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Password recovery is managed by the DB administrator. Please contact IT at security@crowdshield.ai.')}
                className="text-primary hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-4 text-xs font-bold uppercase tracking-wider text-white bg-gradient-premium hover:opacity-95 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg shadow-primary/20 border border-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-t-white border-primary rounded-full animate-spin" />
              ) : (
                <span>Authenticate Session</span>
              )}
            </button>
          </form>

          <div className="text-center mt-5 border-t border-slate-850 pt-4">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
              Demo Logins
            </p>
            <div className="flex justify-center gap-4 mt-1.5 text-[10px] font-mono text-slate-400">
              <div>Admin: <span className="text-primary font-bold">admin</span> / <span className="text-slate-500">admin123</span></div>
              <div>Staff: <span className="text-primary font-bold">volunteer</span> / <span className="text-slate-500">volunteer123</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;