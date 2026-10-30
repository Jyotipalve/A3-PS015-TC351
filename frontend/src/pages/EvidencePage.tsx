import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { fetchDiagnosisHistory } from '../api/client';
import { DiagnosticSession } from '../types';

export const EvidencePage: React.FC = () => {
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

  const currentSession = sessions.length > 0 ? sessions[selectedIdx] : null;
  const diag = currentSession?.diagnosis;
  const tests = currentSession?.tests;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Evidence-to-Action Explorer
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Deterministic inference audit: observed facts, hypothesis evaluation, and confidence transparently explained
          </p>
        </div>

        {sessions.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Session:</span>
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-sky-500"
            >
              {sessions.map((s, idx) => (
                <option key={s.session_id} value={idx}>
                  {new Date(s.created_at).toLocaleTimeString()} - {s.diagnosis?.primary_diagnosis || s.session_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {diag ? (
        <div className="space-y-6">
          {/* Main Verdict Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge variant={diag.severity} />
              <span className="text-xs font-semibold text-slate-700">Confidence: {diag.confidence}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{diag.primary_diagnosis}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              {diag.summary}
            </p>

            <div className="mt-4 p-3.5 rounded-lg bg-sky-50/60 border border-sky-100 text-xs text-sky-950">
              <span className="font-bold">Confidence Explanation: </span>
              {diag.confidence_explanation}
            </div>
          </div>

          {/* Section 1: Observed Evidence */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              1. Observed Telemetry Facts (Deterministic Ground Truth)
            </h3>
            <div className="space-y-2">
              {diag.observed_evidence.map((fact, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{fact}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Hypotheses Evaluation */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              2. Scientific Hypotheses Tested Against Evidence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {diag.hypotheses.map((h, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-900">{h.hypothesis}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
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
                  <p className="text-xs text-slate-600 leading-relaxed">{h.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Alternative Explanations & Cautious Language */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              3. Alternative Explanations & Boundary Conditions
            </h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              NetExplain adheres to strict scientific caution: we do not claim Wi-Fi interference without RF telemetry, and we consider unmeasured environmental factors.
            </p>
            <ul className="space-y-2">
              {diag.alternative_explanations.map((alt, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-amber-50/40 p-2.5 rounded-lg border border-amber-200/60">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{alt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 4: Raw JSON Telemetry Payload */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                4. Raw Diagnostic Telemetry Record
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Database className="h-3.5 w-3.5 text-slate-400" />
                <span>sqlite3</span>
              </div>
            </div>
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-72">
              {JSON.stringify(tests, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <HelpCircle className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Evidence Telemetry Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Execute a diagnostic test to generate verifiable evidence telemetry.
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
