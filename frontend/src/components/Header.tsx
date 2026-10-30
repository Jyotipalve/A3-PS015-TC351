import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  ChevronDown,
  LogIn,
  LogOut,
  X,
  Lock,
} from 'lucide-react';
import { ApiConnectionStatus, HealthResponse, AgentStatusResponse } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onMenuToggle: () => void;
  apiStatus: ApiConnectionStatus;
  apiHealth: HealthResponse | null;
  agentStatus: AgentStatusResponse | null;
  onRetryConnection: () => void;
  isRetrying: boolean;
  pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  apiStatus,
  apiHealth,
  agentStatus,
  onRetryConnection,
  isRetrying,
  pageTitle,
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, register, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Auth form states
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const isEngineReady = agentStatus?.measurement_engine === 'online';

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);

    try {
      if (isRegisterMode) {
        await register(authUsername, authPassword, authDisplayName || undefined);
      } else {
        await login(authUsername, authPassword);
      }
      setAuthModalOpen(false);
      setAuthUsername('');
      setAuthPassword('');
      setAuthDisplayName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const getInitials = () => {
    if (user?.display_name) {
      return user.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return 'GD';
  };

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 sticky top-0 z-20 px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Agent Measurement Engine Status */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium bg-slate-50 border-slate-200 transition-colors"
            role="status"
            aria-live="polite"
          >
            {apiStatus === 'connecting' && (
              <>
                <Loader2 className="h-3.5 w-3.5 text-sky-600 animate-spin" aria-hidden="true" />
                <span className="text-slate-600 hidden sm:inline">Connecting API...</span>
              </>
            )}

            {apiStatus === 'connected' && (
              <>
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${isEngineReady ? 'text-emerald-600' : 'text-amber-500'}`}
                  aria-hidden="true"
                />
                <span className="text-slate-700 hidden sm:inline">
                  API v{apiHealth?.api_version || '0.2.0'} ·{' '}
                  <span className="font-semibold text-slate-900">
                    {isEngineReady ? 'Engine Ready' : 'Engine Unavailable'}
                  </span>
                </span>
                <span className="text-slate-700 sm:hidden">Ready</span>
              </>
            )}

            {apiStatus === 'unavailable' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                <span className="text-amber-800 hidden sm:inline">API Offline (127.0.0.1:8000)</span>
                <span className="text-amber-800 sm:hidden">Offline</span>
                <button
                  type="button"
                  onClick={onRetryConnection}
                  disabled={isRetrying}
                  className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer disabled:opacity-50"
                  aria-label="Retry connecting to API"
                >
                  <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>Retry</span>
                </button>
              </>
            )}
          </div>

          {/* Start Diagnosis Quick CTA */}
          <button
            type="button"
            onClick={() => navigate('/diagnosis')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs transition-colors cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Diagnosis</span>
          </button>

          {/* User Profile / Auth Area */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              aria-label="User profile menu"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  isAuthenticated
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {getInitials()}
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 hidden sm:inline" />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-30"
                onMouseLeave={() => setProfileOpen(false)}
              >
                {isAuthenticated ? (
                  <div>
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        {getInitials()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {user?.display_name || user?.username}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          Authenticated Diagnostician
                        </div>
                      </div>
                    </div>
                    <div className="py-2 text-[11px] text-slate-600 font-mono">
                      User: @{user?.username}
                    </div>
                    <button
                      onClick={async () => {
                        await logout();
                        setProfileOpen(false);
                        navigate('/login');
                      }}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                        GD
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Guest Diagnostician</div>
                        <div className="text-[10px] text-slate-500">Local Single Session</div>
                      </div>
                    </div>
                    <p className="py-2 text-[11px] text-slate-600 leading-relaxed">
                      Sign in with an account to attach audit sessions, generate verified reports, and manage settings.
                    </p>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/login');
                      }}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 transition-colors cursor-pointer shadow-xs"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Sign In / Register</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Interactive Authentication Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close auth dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isRegisterMode ? 'Create Diagnostician Account' : 'Sign In to NetExplain'}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {isRegisterMode ? 'Secure PBKDF2 Password Hashing' : 'Enter your credentials'}
                </span>
              </div>
            </div>

            {authError && (
              <div className="p-2.5 mb-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. alex_network"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {isRegisterMode && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Display Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                {authSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRegisterMode ? (
                  <span>Create Account</span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
              {isRegisterMode ? (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setAuthError(null);
                    }}
                    className="font-semibold text-sky-700 hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  New to NetExplain?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setAuthError(null);
                    }}
                    className="font-semibold text-sky-700 hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
