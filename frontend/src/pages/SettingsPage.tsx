import React, { useState, useEffect } from 'react';
import { CheckCircle2, Server, Save, RotateCcw } from 'lucide-react';
import { fetchAgentStatus } from '../api/client';
import { AgentStatusResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const SettingsPage: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
  const [dnsTarget, setDnsTarget] = useState<string>('google.com');
  const [icmpTarget, setIcmpTarget] = useState<string>('1.1.1.1');
  const [httpTarget, setHttpTarget] = useState<string>('https://connectivitycheck.gstatic.com/generate_204');
  const [pingCount, setPingCount] = useState<number>(4);
  const [pingTimeout, setPingTimeout] = useState<number>(1000);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    fetchAgentStatus().then(setAgentStatus).catch(() => {});
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleReset = () => {
    setDnsTarget('google.com');
    setIcmpTarget('1.1.1.1');
    setHttpTarget('https://connectivitycheck.gstatic.com/generate_204');
    setPingCount(4);
    setPingTimeout(1000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Agent & Diagnostic Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Configure diagnostic probe endpoints, measurement safety bounds, and agent parameters
        </p>
      </div>

      {/* Agent Capability Matrix */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Local Diagnostic Measurement Engine</h2>
              <span className="text-xs text-slate-500 font-mono">FastAPI + OS Socket / ICMP Engine</span>
            </div>
          </div>
          <StatusBadge
            variant={agentStatus?.measurement_engine === 'online' ? 'healthy' : 'offline'}
            label={agentStatus?.measurement_engine === 'online' ? 'Engine Online' : 'Engine Offline'}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {agentStatus?.capabilities?.map((cap, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-slate-900">{cap.name}</span>
                <span className="text-[10px] text-emerald-800 bg-emerald-100 font-mono px-1.5 py-0.5 rounded">
                  Enabled
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Probe Configuration Form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">Probe Safety & Endpoint Parameters</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bounded limits ensure measurements never congest or degrade active user traffic
          </p>
        </div>

        {savedNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Settings saved successfully for local session.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-800 mb-1">Default DNS Query Target</label>
            <input
              type="text"
              value={dnsTarget}
              onChange={(e) => setDnsTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Hostname passed to system socket resolver</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Public ICMP Echo Endpoint</label>
            <input
              type="text"
              value={icmpTarget}
              onChange={(e) => setIcmpTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Reliable anycast public edge IP (e.g. 1.1.1.1 or 8.8.8.8)</span>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-800 mb-1">HTTP/HTTPS Reachability Probe URL</label>
            <input
              type="text"
              value={httpTarget}
              onChange={(e) => setHttpTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Fast 204 endpoint to verify web access and detect captive portals</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">ICMP Probes per Test (Bounded: 1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={pingCount}
              onChange={(e) => setPingCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Per-Probe Timeout (ms, Bounded: 500-5000)</label>
            <input
              type="number"
              min={500}
              max={5000}
              step={100}
              value={pingTimeout}
              onChange={(e) => setPingTimeout(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white shadow-xs cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
