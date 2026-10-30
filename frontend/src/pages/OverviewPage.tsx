import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Play,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { NetworkPath } from '../components/NetworkPath';
import { TelemetryGlobe } from '../components/TelemetryGlobe';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { fetchDiagnosisHistory } from '../api/client';
import { DiagnosticSession } from '../types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchDiagnosisHistory(10);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const latestSession = sessions.length > 0 ? sessions[0] : null;
  const latestTests = latestSession?.tests;
  const latestDiag = latestSession?.diagnosis;

  // Extract real metric values from latest session
  const gwVal = latestTests?.gateway?.measured_values;
  const dnsVal = latestTests?.dns?.measured_values;
  const icmpVal = latestTests?.external_icmp?.measured_values;
  const httpVal = latestTests?.external_http?.measured_values;
  const lossVal = latestTests?.packet_loss?.measured_values;
  const loadVal = latestTests?.mild_load?.measured_values;

  // Format timestamp
  const formatTime = (iso?: string) => {
    if (!iso) return undefined;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return undefined;
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero & Connection Summary Banner */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse" />
            AIORI Hackathon 3 · Smart Cities PS-015
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Understand your connection, not just your speed.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 mt-2 sm:mt-3 leading-relaxed">
            NetExplain analyzes packet queuing, local gateway response, DNS resolver latency, and 
            mild-load bufferbloat to explain exactly where and why connection latency degrades.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/diagnosis')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs transition-all cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start Diagnosis</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/topology')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors cursor-pointer"
            >
              <span>Inspect Path</span>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Real Connection Summary Badge */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Current Link Health Verdict
          </div>

          {latestSession ? (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                latestDiag?.severity === 'healthy'
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                  : latestDiag?.severity === 'critical'
                  ? 'bg-rose-50/40 border-rose-200 text-rose-950'
                  : latestDiag?.severity === 'warning'
                  ? 'bg-amber-50/40 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white shadow-2xs mt-0.5">
                  {latestDiag?.severity === 'healthy' ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  ) : latestDiag?.severity === 'critical' ? (
                    <XCircle className="h-5 w-5 text-rose-600" />
                  ) : latestDiag?.severity === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <HelpCircle className="h-5 w-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {latestDiag?.primary_diagnosis || 'Session Measured'}
                    </span>
                    <StatusBadge variant={latestDiag?.severity || 'info'} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                    {latestDiag?.summary || latestSession.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-xs text-slate-400 font-mono">
                  {formatTime(latestSession.completed_at || latestSession.created_at)}
                </span>
                <Link
                  to="/evidence"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline ml-2"
                >
                  <span>Evidence Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">
                  Not measured yet. Launch your first diagnostic session to evaluate connection integrity.
                </span>
              </div>
              <StatusBadge variant="pending" label="No Active Baseline" />
            </div>
          )}
        </div>
      </section>

      {/* 5 Real Diagnostic Metrics (Null values NEVER show 0) */}
      <section aria-labelledby="metrics-heading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="metrics-heading" className="text-base font-semibold text-slate-900">
              Diagnostic Telemetry Indicators
            </h2>
            <p className="text-xs text-slate-500">
              Live link health metrics mapped from latest real measurement
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 p-1"
            title="Refresh history"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Gateway RTT */}
          <MetricCard
            title="Gateway Latency"
            subtitle="Local LAN / Wi-Fi Hop"
            iconName="wifi"
            value={gwVal?.rtt_avg_ms !== undefined ? gwVal.rtt_avg_ms : null}
            unit="ms"
            status={latestTests?.gateway?.status || 'pending'}
            statusText={latestTests?.gateway?.status || 'Not tested'}
            target={gwVal?.gateway_ip}
            detail={gwVal?.packet_loss_pct !== undefined ? `${gwVal.packet_loss_pct}% loss` : 'Local router hop'}
            lastTested={formatTime(latestTests?.gateway?.end_time)}
          />

          {/* 2. DNS Resolution Time */}
          <MetricCard
            title="DNS Lookup"
            subtitle="System Resolver Time"
            iconName="globe"
            value={dnsVal?.resolution_time_ms !== undefined ? dnsVal.resolution_time_ms : null}
            unit="ms"
            status={latestTests?.dns?.status || 'pending'}
            statusText={latestTests?.dns?.status || 'Not tested'}
            target={dnsVal?.hostname}
            detail={dnsVal?.ip_count ? `${dnsVal.ip_count} IPs mapped` : 'Name directory'}
            lastTested={formatTime(latestTests?.dns?.end_time)}
          />

          {/* 3. End-to-End Packet Loss */}
          <MetricCard
            title="Packet Loss"
            subtitle="Public Probes Lost"
            iconName="activity"
            value={lossVal?.packet_loss_pct !== undefined ? `${lossVal.packet_loss_pct}%` : null}
            status={latestTests?.packet_loss?.status || 'pending'}
            statusText={latestTests?.packet_loss?.status || 'Not tested'}
            target={lossVal?.target}
            detail={lossVal?.packets_sent ? `${lossVal.packets_received}/${lossVal.packets_sent} received` : 'ICMP burst test'}
            lastTested={formatTime(latestTests?.packet_loss?.end_time)}
          />

          {/* 4. External Web Verification */}
          <MetricCard
            title="External Reach"
            subtitle="Dual ICMP + Web"
            iconName="server"
            value={httpVal?.status_code ? `HTTP ${httpVal.status_code}` : icmpVal?.rtt_avg_ms ? `${icmpVal.rtt_avg_ms}ms` : null}
            status={latestTests?.external_http?.status || latestTests?.external_icmp?.status || 'pending'}
            statusText={latestTests?.external_http?.status || 'Not tested'}
            target="Cloudflare / Google"
            detail={httpVal?.http_rtt_ms ? `Web RTT: ${httpVal.http_rtt_ms}ms` : 'Public edge check'}
            lastTested={formatTime(latestTests?.external_http?.end_time)}
          />

          {/* 5. Baseline vs Mild Load Bufferbloat */}
          <MetricCard
            title="Mild-Load Delta"
            subtitle="Bufferbloat Indicator"
            iconName="layers"
            value={loadVal?.delta_ms !== undefined ? `+${loadVal.delta_ms}` : null}
            unit="ms"
            status={latestTests?.mild_load?.status || 'pending'}
            statusText={latestTests?.mild_load?.status || 'Not tested'}
            target="Loaded RTT"
            detail={loadVal?.ratio ? `${loadVal.ratio}x idle latency` : 'Queue delay check'}
            lastTested={formatTime(latestTests?.mild_load?.end_time)}
          />
        </div>
      </section>

      {/* Global 3D Telemetry Propagation Globe */}
      <section aria-labelledby="telemetry-globe-heading">
        <TelemetryGlobe
          session={latestSession}
          tests={latestTests}
          height={340}
          title="Global Telemetry Propagation Globe"
          subtitle="Interactive 3D network path rendering from local client to target infrastructure endpoints"
        />
      </section>

      {/* Network Path Topology Visualization */}
      <section aria-labelledby="path-heading">
        <NetworkPath tests={latestTests} />
      </section>

      {/* Helpful Next Action Card */}
      {latestDiag && (
        <section className="bg-white rounded-xl border border-sky-100 p-6 shadow-xs bg-gradient-to-r from-sky-50/50 to-white">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-sky-700 text-white shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-800 mb-1">
                Helpful Next Action (Based on Real Telemetry)
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {latestDiag.next_recommended_test}
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Confidence rating: <span className="font-semibold text-slate-800">{latestDiag.confidence}</span> — {latestDiag.confidence_explanation}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/resolve"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-700 text-white hover:bg-sky-800 transition-colors shadow-2xs"
                >
                  <span>Open Resolution Steps</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span>Generate ISP Ticket</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Workflow Explanation: Measure -> Correlate -> Explain -> Resolve */}
      <section aria-labelledby="workflow-heading" className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
        <div className="mb-5">
          <h2 id="workflow-heading" className="text-base font-semibold text-slate-900">
            How NetExplain Resolves Connectivity Bottlenecks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            The four-stage architecture powering explainable last-mile intelligence
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-sky-700 text-white text-[11px] font-bold flex items-center justify-center">
                1
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Measure
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Injects safe, bounded micro-probes across gateway, DNS, external IP, and mild-load HTTP without saturating your link.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-sky-700 text-white text-[11px] font-bold flex items-center justify-center">
                2
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Correlate
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deterministic rule engine tests physical link outages, bufferbloat queues, DNS resolver drops, and upstream ISP transit failures.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-sky-700 text-white text-[11px] font-bold flex items-center justify-center">
                3
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Explain
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Provides plain-language explanations with transparent confidence ratings, evidence logs, and alternative hypotheses.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/70">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-sky-700 text-white text-[11px] font-bold flex items-center justify-center">
                4
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Resolve
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Guides users through self-help steps (e.g. SQM / QoS setup) and produces structured evidence exports for ISP escalation.
            </p>
          </div>
        </div>
      </section>

      {/* Recent Diagnostic Sessions List */}
      <section aria-labelledby="sessions-heading" className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 id="sessions-heading" className="text-base font-semibold text-slate-900">
              Recent Diagnostic Sessions
            </h2>
            <p className="text-xs text-slate-500">
              Historical audit trail of host connectivity evaluations
            </p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
          >
            View All ({sessions.length})
          </Link>
        </div>

        {sessions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => {
              const diag = s.diagnosis;
              const gw = s.tests?.gateway?.measured_values;
              const loss = s.tests?.packet_loss?.measured_values;
              return (
                <div
                  key={s.session_id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 mt-0.5">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {diag?.primary_diagnosis || s.summary || 'Diagnostic Run'}
                        </span>
                        <StatusBadge variant={diag?.severity || s.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span>Gateway: <span className="font-mono text-slate-700">{gw?.rtt_avg_ms !== null && gw?.rtt_avg_ms !== undefined ? `${gw.rtt_avg_ms}ms` : '—'}</span></span>
                        <span>Loss: <span className="font-mono text-slate-700">{loss?.packet_loss_pct !== null && loss?.packet_loss_pct !== undefined ? `${loss.packet_loss_pct}%` : '—'}</span></span>
                        <span className="text-slate-400 font-mono text-[10px]">{s.session_id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs text-slate-400 font-mono">
                      {formatTime(s.completed_at || s.created_at)}
                    </span>
                    <button
                      onClick={() => navigate('/evidence')}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Clock}
            title="No Diagnostic Sessions Yet"
            description="Your local host has not executed any network measurement probes. Launch a new diagnosis session to evaluate your link."
            action={{
              label: 'Start First Diagnosis',
              onClick: () => navigate('/diagnosis'),
            }}
            note="NetExplain SQLite Persistent Audit Store"
          />
        )}
      </section>
    </div>
  );
};
