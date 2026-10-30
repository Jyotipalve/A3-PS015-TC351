import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Sliders,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { fetchDiagnosisHistory } from '../api/client';
import { DiagnosticSession } from '../types';

export const ResolutionPage: React.FC = () => {
  const navigate = useNavigate();
  const [latestSession, setLatestSession] = useState<DiagnosticSession | null>(null);

  useEffect(() => {
    fetchDiagnosisHistory(1).then((data) => {
      if (data && data.length > 0) {
        setLatestSession(data[0]);
      }
    }).catch(() => {});
  }, []);

  const diag = latestSession?.diagnosis;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Resolution Guide & Troubleshooting Playbook
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Evidence-based actionable steps to resolve home bottleneck issues and improve link quality
        </p>
      </div>

      {diag ? (
        <div className="space-y-6">
          {/* Active Diagnostic Context Banner */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge variant={diag.severity} />
                <span className="text-xs text-slate-500 font-medium">Active Diagnosis Reference</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{diag.primary_diagnosis}</h2>
              <p className="text-xs text-slate-600 mt-0.5">{diag.summary}</p>
            </div>

            <button
              onClick={() => navigate('/reports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white transition-colors cursor-pointer shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Generate ISP Ticket</span>
            </button>
          </div>

          {/* Step-by-Step Resolution Steps */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Recommended Remediation Sequence
            </h3>

            <div className="space-y-3">
              {diag.resolution_steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-100 bg-slate-50/60">
                  <div className="w-6 h-6 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 mb-0.5">Action Step {idx + 1}</h4>
                    <p className="text-xs text-slate-700 leading-relaxed">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Playbooks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Playbook A: Bufferbloat & SQM */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <Sliders className="h-4 w-4 text-sky-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Bufferbloat Fix: Smart Queue Management (SQM)
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                If your diagnosis showed high mild-load delta latency, enable Active Queue Management on your home router:
              </p>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>Log in to your router web GUI (typically <code>192.168.1.1</code> or <code>192.168.0.1</code>).</li>
                <li>Navigate to <strong>Quality of Service (QoS)</strong> or <strong>SQM</strong>.</li>
                <li>Select queuing algorithm <strong>Cake</strong> or <strong>FQ-CoDel</strong>.</li>
                <li>Set upload limit to 90% of your maximum plan speed to keep buffers clear.</li>
              </ul>
            </div>

            {/* Playbook B: DNS Redundancy */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-sky-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  DNS Fix: Fast Public Resolvers
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                If DNS lookup latency is slow or failing, switch away from slow default ISP resolvers:
              </p>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
                <li>Primary IPv4 DNS: <code>1.1.1.1</code> (Cloudflare) or <code>8.8.8.8</code> (Google).</li>
                <li>Secondary IPv4 DNS: <code>1.0.0.1</code> or <code>8.8.4.4</code>.</li>
                <li>In Windows PowerShell: <code>Clear-DnsClientCache</code>.</li>
                <li>In Linux terminal: <code>resolvectl flush-caches</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <HelpCircle className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Active Diagnosis Loaded</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Run a diagnostic test first to generate customized resolution advice.
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
