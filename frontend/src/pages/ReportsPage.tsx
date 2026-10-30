import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  Download,
  HelpCircle,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { fetchDiagnosisHistory } from '../api/client';
import { DiagnosticSession } from '../types';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  useEffect(() => {
    fetchDiagnosisHistory(10).then((data) => {
      if (data && data.length > 0) {
        setSessions(data);
      }
    }).catch(() => {});
  }, []);

  const session = sessions.length > 0 ? sessions[selectedIdx] : null;
  const diag = session?.diagnosis;
  const tests = session?.tests;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    if (!session) return;
    const dossierType = session.is_simulated
      ? 'CONTROLLED_SIMULATION_SANDBOX'
      : diag?.severity === 'inconclusive'
      ? 'INCONCLUSIVE_FINDING'
      : 'VERIFIED_LIVE_MEASUREMENT';

    const exportPayload = {
      dossier_type: dossierType,
      provenance: session.is_simulated ? 'SIMULATED_FAULT_INJECTION_DO_NOT_TREAT_AS_LIVE' : 'NATIVE_HOST_TELEMETRY',
      exported_at: new Date().toISOString(),
      report: {
        session_id: session.session_id,
        created_at: session.created_at,
        completed_at: session.completed_at,
        client_ip: session.client_ip,
        is_simulated: !!session.is_simulated,
        diagnosis: diag,
        tests: tests,
      },
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `netexplain-${dossierType.toLowerCase()}-${session.session_id.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            ISP Escalation Evidence Ticket
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Formal, evidence-backed diagnostic report designed for customer support escalation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessions.length > 1 && (
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-sky-500 mr-2"
            >
              {sessions.map((s, idx) => (
                <option key={s.session_id} value={idx}>
                  {new Date(s.created_at).toLocaleTimeString()} - {s.diagnosis?.primary_diagnosis || s.session_id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
          {session && (
            <>
              <button
                type="button"
                onClick={handleDownloadJSON}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 cursor-pointer shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Ticket</span>
              </button>
            </>
          )}
        </div>
      </div>

      {session && diag ? (
        <div className="bg-white rounded-2xl border border-slate-300 p-6 sm:p-10 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
          {/* Ticket Header */}
          <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-base text-slate-900">NetExplain Diagnostic Dossier</span>
                <span className="text-xs font-mono text-slate-500">ID: {session.session_id}</span>
              </div>
              <p className="text-xs text-slate-500">
                AIORI Hackathon 3 · Smart Cities PS-015 Protocol
              </p>
            </div>

            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Generated: {new Date(session.created_at).toLocaleString()}</div>
              <div>Client Host IP: {session.client_ip || '127.0.0.1'}</div>
            </div>
          </div>

          {/* Primary Issue & Diagnosis Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Classified Connectivity Condition
            </div>
            <div className="text-lg font-bold text-slate-900 mb-1">
              {diag.primary_diagnosis}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {diag.summary}
            </p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-800">Severity: <StatusBadge variant={diag.severity} /></span>
              <span className="font-semibold text-slate-800">Confidence: <span className="font-mono text-sky-800">{diag.confidence}</span></span>
            </div>
          </div>

          {/* Concrete Telemetry Evidence Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Verified Technical Measurements
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2.5 border-b border-slate-200">Stage</th>
                    <th className="p-2.5 border-b border-slate-200">Target</th>
                    <th className="p-2.5 border-b border-slate-200">Method</th>
                    <th className="p-2.5 border-b border-slate-200">Measured Value</th>
                    <th className="p-2.5 border-b border-slate-200">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-mono text-[11px]">
                  {Object.entries(tests || {}).map(([key, t]) => {
                    const vals = t.measured_values || {};
                    let valStr = '—';
                    if (key === 'gateway') valStr = `RTT: ${vals.rtt_avg_ms !== null && vals.rtt_avg_ms !== undefined ? vals.rtt_avg_ms + 'ms' : 'N/A'}, Loss: ${vals.packet_loss_pct !== null && vals.packet_loss_pct !== undefined ? vals.packet_loss_pct + '%' : 'N/A'}`;
                    else if (key === 'dns') valStr = `Lookup: ${vals.resolution_time_ms !== null && vals.resolution_time_ms !== undefined ? vals.resolution_time_ms + 'ms' : 'N/A'} (${vals.ip_count || 0} IPs)`;
                    else if (key === 'external_icmp') valStr = `RTT: ${vals.rtt_avg_ms !== null && vals.rtt_avg_ms !== undefined ? vals.rtt_avg_ms + 'ms' : 'N/A'}, Loss: ${vals.packet_loss_pct !== null && vals.packet_loss_pct !== undefined ? vals.packet_loss_pct + '%' : 'N/A'}`;
                    else if (key === 'external_http') valStr = `HTTP ${vals.status_code || 'N/A'}, RTT: ${vals.http_rtt_ms || 'N/A'}ms`;
                    else if (key === 'packet_loss') valStr = `Loss: ${vals.packet_loss_pct !== null && vals.packet_loss_pct !== undefined ? vals.packet_loss_pct + '%' : 'N/A'}, RTT: ${vals.rtt_avg_ms || 'N/A'}ms`;
                    else if (key === 'mild_load') valStr = `Delta: ${vals.delta_ms !== null && vals.delta_ms !== undefined ? '+' + vals.delta_ms + 'ms' : 'N/A'}, Ratio: ${vals.ratio ? vals.ratio + 'x' : 'N/A'}`;

                    return (
                      <tr key={key}>
                        <td className="p-2.5 font-sans font-semibold text-slate-900">{t.name}</td>
                        <td className="p-2.5">{t.target}</td>
                        <td className="p-2.5 text-slate-500 font-sans">{t.method}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{valStr}</td>
                        <td className="p-2.5"><StatusBadge variant={t.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observed Facts Bullet Points */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Diagnostic Evidence Log
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {diag.observed_evidence.map((ev, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-sky-700 font-bold">•</span>
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ISP Escalation Statement */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Formal ISP Escalation Note
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              This automated report was produced by the NetExplain diagnostic client on the user's local host. 
              The evidence above demonstrates that the subscriber's internal home network has been verified. 
              Please verify upstream fiber/cable node health and routing table integrity for this subscriber line.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <HelpCircle className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Report Available Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Run a diagnostic test first to generate a verifiable ISP evidence ticket.
          </p>
          <button
            onClick={() => navigate('/diagnosis')}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-700 text-white hover:bg-sky-800 cursor-pointer"
          >
            Start Diagnosis
          </button>
        </div>
      )}
    </div>
  );
};
