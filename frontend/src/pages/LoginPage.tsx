import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Activity, Lock, User as UserIcon, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-700 text-white shadow-md shadow-sky-700/20 mb-3">
          <Activity className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in to NetExplain
        </h2>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          Measure. Explain. Resolve.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/90 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. network_admin"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-600 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Shortcut for Hackathon Judges */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-700" />
              <span>Hackathon Judge Quick-Access</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('judge_admin', 'Passcode2026!')}
                className="text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] text-slate-700 transition-colors"
              >
                <div className="font-semibold text-slate-900">Fill: Lead Judge</div>
                <div className="text-slate-500">judge_admin</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('network_ops', 'Passcode2026!')}
                className="text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] text-slate-700 transition-colors"
              >
                <div className="font-semibold text-slate-900">Fill: NetOps Tech</div>
                <div className="text-slate-500">network_ops</div>
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              New demo accounts are auto-registered if not yet present in the SQLite DB.
            </p>
          </div>

          <div className="mt-6 text-center text-xs text-slate-600">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-semibold text-sky-700 hover:text-sky-800 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
