import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Clock,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Trash2,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { fetchDiagnosisHistory, clearDiagnosisHistory } from '../api/client';
import { DiagnosticSession } from '../types';
import { useAuth } from '../context/AuthContext';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [clearNotice, setClearNotice] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await fetchDiagnosisHistory(50, true);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to purge all diagnostic history records?')) {
      return;
    }
    try {
      await clearDiagnosisHistory();
      setSessions([]);
      setClearNotice('Diagnostic session history has been purged.');
      setTimeout(() => setClearNotice(null), 3000);
    } catch (err: any) {
      alert(`Unable to clear history: ${err.message}. Ensure you are signed in.`);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (filterSeverity === 'all') return true;
    if (filterSeverity === 'simulated') return s.is_simulated;
    if (filterSeverity === 'live') return !s.is_simulated;
    return s.diagnosis?.severity === filterSeverity;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Diagnostic Session History
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Audit trail of historical host connectivity assessments saved to SQLite
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Sessions</option>
            <option value="live">Live Only</option>
            <option value="simulated">Simulated Only</option>
            <option value="healthy">Healthy Only</option>
            <option value="warning">Warning Only</option>
            <option value="critical">Critical Only</option>
          </select>

          {isAuthenticated && sessions.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
              title="Purge session history"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={loadSessions}
            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {clearNotice && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          {clearNotice}
        </div>
      )}

      {/* Sessions Table / List */}
      {filteredSessions.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredSessions.map((s) => {
            const diag = s.diagnosis;
            const gw = s.tests?.gateway?.measured_values;
            const dns = s.tests?.dns?.measured_values;
            const loss = s.tests?.packet_loss?.measured_values;
            const load = s.tests?.mild_load?.measured_values;

            return (
              <div
                key={s.session_id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 mt-0.5">
                    {diag?.severity === 'healthy' ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    ) : diag?.severity === 'critical' ? (
                      <XCircle className="h-5 w-5 text-rose-600" />
                    ) : diag?.severity === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {diag?.primary_diagnosis || s.summary || 'Diagnostic Session'}
                      </span>
                      {s.is_simulated && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                          SIMULATED
                        </span>
                      )}
                      <StatusBadge variant={diag?.severity || s.status} />
                    </div>

                    <div className="text-xs text-slate-600 mt-1 max-w-xl line-clamp-1">
                      {diag?.summary || s.summary || 'Recorded session telemetry'}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-2">
                      <span>Gateway: <span className="font-semibold text-slate-800">{gw?.rtt_avg_ms !== null && gw?.rtt_avg_ms !== undefined ? `${gw.rtt_avg_ms}ms` : '—'}</span></span>
                      <span>DNS: <span className="font-semibold text-slate-800">{dns?.resolution_time_ms !== null && dns?.resolution_time_ms !== undefined ? `${dns.resolution_time_ms}ms` : '—'}</span></span>
                      <span>Loss: <span className="font-semibold text-slate-800">{loss?.packet_loss_pct !== null && loss?.packet_loss_pct !== undefined ? `${loss.packet_loss_pct}%` : '—'}</span></span>
                      <span>Bufferbloat: <span className="font-semibold text-slate-800">{load?.delta_ms !== null && load?.delta_ms !== undefined ? `+${load.delta_ms}ms` : '—'}</span></span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(s.completed_at || s.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => navigate('/evidence')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                  >
                    <span>Inspect Evidence</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title="No Matching Diagnostic Sessions"
          description={
            sessions.length === 0
              ? 'No diagnostic sessions have been executed on this machine yet.'
              : 'No sessions match your selected severity filter.'
          }
          action={{
            label: 'Run First Diagnosis',
            onClick: () => navigate('/diagnosis'),
          }}
          note="Saved to backend/netexplain.db"
        />
      )}
    </div>
  );
};
