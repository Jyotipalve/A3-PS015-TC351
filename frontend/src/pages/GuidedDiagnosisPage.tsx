import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  StopCircle,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  FileText,
  Sliders,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { startFullDiagnosis, pollDiagnosisSession, cancelDiagnosisSession } from '../api/client';
import { DiagnosticSession, RunDiagnosisRequest } from '../types';

export const GuidedDiagnosisPage: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Diagnostic target overrides (customizable by user)
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [gatewayOverride, setGatewayOverride] = useState<string>('');
  const [dnsHostname, setDnsHostname] = useState<string>('google.com');
  const [icmpTarget, setIcmpTarget] = useState<string>('1.1.1.1');
  const [httpTarget, setHttpTarget] = useState<string>('https://connectivitycheck.gstatic.com/generate_204');

  const pollIntervalRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleStartDiagnosis = async () => {
    setErrorMsg(null);
    setIsRunning(true);
    stopPolling();

    const params: RunDiagnosisRequest = {
      gateway_override: gatewayOverride.trim() || undefined,
      dns_hostname: dnsHostname.trim() || 'google.com',
      icmp_target: icmpTarget.trim() || '1.1.1.1',
      http_target: httpTarget.trim() || 'https://connectivitycheck.gstatic.com/generate_204',
    };

    try {
      const initialSession = await startFullDiagnosis(params);
      setSession(initialSession);

      // Start polling session state every 1.2 seconds
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const updated = await pollDiagnosisSession(initialSession.session_id);
          setSession(updated);

          if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'cancelled') {
            setIsRunning(false);
            stopPolling();
          }
        } catch (err: any) {
          setErrorMsg(`Polling error: ${err.message}`);
          setIsRunning(false);
          stopPolling();
        }
      }, 1200);
    } catch (err: any) {
      setErrorMsg(`Failed to initiate diagnostic session: ${err.message}`);
      setIsRunning(false);
    }
  };

  const handleCancelDiagnosis = async () => {
    if (session && isRunning) {
      try {
        await cancelDiagnosisSession(session.session_id);
        setIsRunning(false);
        stopPolling();
        setSession((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      } catch (err: any) {
        setErrorMsg(`Cancellation failed: ${err.message}`);
      }
    }
  };

  const testList = [
    { id: 'gateway', label: 'Default Gateway Reachability', desc: 'Detects local router gateway and measures LAN/Wi-Fi RTT' },
    { id: 'dns', label: 'DNS Resolution Latency', desc: 'Queries system resolver socket for hostname lookup timing' },
    { id: 'external_icmp', label: 'External ICMP Echo', desc: 'Probes public IP edge to verify outbound IP packet delivery' },
    { id: 'external_http', label: 'External HTTP Verification', desc: 'Validates web access and detects captive portal redirects' },
    { id: 'packet_loss', label: 'End-to-End Packet Loss', desc: 'Sends bounded probe sequence to compute packet drop rate and RTT spread' },
    { id: 'mild_load', label: 'Mild-Load Bufferbloat', desc: 'Samples latency before and during non-saturating HTTP download to detect queue delay' },
  ];

  const diag = session?.diagnosis;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Live Diagnostic Session Runner
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Execute active end-to-end network telemetry tests with real-time status polling
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span>{showConfig ? 'Hide Targets' : 'Configure Targets'}</span>
          </button>

          {!isRunning ? (
            <button
              type="button"
              onClick={handleStartDiagnosis}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-xs transition-colors cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{session ? 'Run New Diagnosis' : 'Start Full Diagnosis'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelDiagnosis}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors cursor-pointer"
            >
              <StopCircle className="h-4 w-4" />
              <span>Cancel Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Configuration Panel */}
      {showConfig && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Probe Target Parameters (Customizable)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Gateway Override (Optional)</label>
              <input
                type="text"
                placeholder="Auto-detect"
                value={gatewayOverride}
                onChange={(e) => setGatewayOverride(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">DNS Hostname</label>
              <input
                type="text"
                value={dnsHostname}
                onChange={(e) => setDnsHostname(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">ICMP Public Edge</label>
              <input
                type="text"
                value={icmpTarget}
                onChange={(e) => setIcmpTarget(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">HTTP Verification URL</label>
              <input
                type="text"
                value={httpTarget}
                onChange={(e) => setHttpTarget(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Active Run Progress Bar */}
      {session && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">
                Session <span className="font-mono text-slate-600">{session.session_id.slice(0, 8)}</span>
              </span>
              <StatusBadge variant={session.status} />
              {session.status === 'completed' && session.completed_at && (
                <span className="text-[11px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded ml-1">
                  Completed at: {new Date(session.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Intl.DateTimeFormat().resolvedOptions().timeZone})
                </span>
              )}
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700">
              {session.progress_pct}%
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-4">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                session.status === 'completed'
                  ? 'bg-emerald-500'
                  : session.status === 'cancelled'
                  ? 'bg-slate-400'
                  : 'bg-sky-600'
              }`}
              style={{ width: `${session.progress_pct}%` }}
            />
          </div>

          {/* Per-Test Execution State Grid */}
          <div className="space-y-2.5">
            {testList.map((item) => {
              const testData = session.tests?.[item.id];
              const testStatus = testData?.status || 'pending';
              const measured = testData?.measured_values || {};

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    testStatus === 'running'
                      ? 'border-sky-300 bg-sky-50/40 ring-1 ring-sky-200'
                      : testStatus === 'pass'
                      ? 'border-slate-200 bg-white'
                      : testStatus === 'fail'
                      ? 'border-rose-200 bg-rose-50/20'
                      : testStatus === 'warning'
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {testStatus === 'running' ? (
                        <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
                      ) : testStatus === 'pass' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : testStatus === 'fail' ? (
                        <XCircle className="h-4 w-4 text-rose-600" />
                      ) : testStatus === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{testData?.interpretation || item.desc}</div>
                    </div>
                  </div>

                  {/* Measured values pill */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    {testData?.duration_ms !== undefined && testData?.duration_ms !== null && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {testData.duration_ms}ms
                      </span>
                    )}

                    {item.id === 'gateway' && measured.rtt_avg_ms !== undefined && measured.rtt_avg_ms !== null && (
                      <span className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {measured.rtt_avg_ms}ms
                      </span>
                    )}
                    {item.id === 'dns' && measured.resolution_time_ms !== undefined && measured.resolution_time_ms !== null && (
                      <span className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {measured.resolution_time_ms}ms
                      </span>
                    )}
                    {item.id === 'packet_loss' && measured.packet_loss_pct !== undefined && measured.packet_loss_pct !== null && (
                      <span className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {measured.packet_loss_pct}% loss
                      </span>
                    )}
                    {item.id === 'mild_load' && measured.delta_ms !== undefined && measured.delta_ms !== null && (
                      <span className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        +{measured.delta_ms}ms
                      </span>
                    )}

                    <StatusBadge variant={testStatus} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Synthesis Card: Appears upon Session Completion */}
      {diag && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <StatusBadge variant={diag.severity} />
                <span className="text-xs text-slate-500 font-medium">Confidence: {diag.confidence}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {diag.primary_diagnosis}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {diag.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/reports')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>ISP Ticket</span>
              </button>
              <button
                onClick={() => navigate('/resolve')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white transition-colors cursor-pointer shadow-2xs"
              >
                <span>Resolution Guide</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Observed Evidence Section */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Observed Telemetry Evidence
            </h3>
            <ul className="space-y-2">
              {diag.observed_evidence.map((ev, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{ev}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hypotheses Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Hypotheses Tested & Evaluated
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {diag.hypotheses.map((h, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-200/80 bg-white text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-slate-900">{h.hypothesis}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        h.state === 'supported'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : h.state === 'contradicted'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {h.state}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{h.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resolution Steps Preview */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Immediate User Resolution Steps
            </h3>
            <div className="space-y-1.5">
              {diag.resolution_steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="font-bold text-sky-700">{idx + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
