import React, { useState } from 'react';
import {
  Play,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { runSimulation } from '../api/client';
import { DiagnosticSession } from '../types';

interface SimulatedScenarioPreset {
  id: string;
  backendId: string;
  title: string;
  category: string;
  description: string;
  expectedDiagnosis: string;
  expectedSeverity: 'healthy' | 'warning' | 'critical' | 'inconclusive';
}

export const SimulationPage: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<string>('bufferbloat');
  const [simulatedSession, setSimulatedSession] = useState<DiagnosticSession | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scenarios: SimulatedScenarioPreset[] = [
    {
      id: 'bufferbloat',
      backendId: 'bufferbloat',
      title: 'Last-Mile Bufferbloat Saturation',
      category: 'Queue Delay',
      description: 'Simulates unmanaged router packet queuing where mild concurrent traffic causes latency to spike from 20ms to 145ms (+125ms delta, 7.25x baseline).',
      expectedDiagnosis: 'Last-Mile Bufferbloat Under Load',
      expectedSeverity: 'warning',
    },
    {
      id: 'isp_outage',
      backendId: 'gateway_down', // or dedicated ISP
      title: 'Local Wi-Fi / Gateway Disconnected',
      category: 'Physical Link',
      description: 'Simulates local router being completely unreachable (100% loss to default gateway). Immediate physical LAN disconnection.',
      expectedDiagnosis: 'Local Gateway Unreachable',
      expectedSeverity: 'critical',
    },
    {
      id: 'dns_failure',
      backendId: 'dns_failure',
      title: 'Default ISP DNS Resolver Denial',
      category: 'Directory Failure',
      description: 'Direct IP routing to public IPs succeeds with 0% loss, but system socket resolver fails to translate domain names, breaking browsing.',
      expectedDiagnosis: 'DNS Resolution Infrastructure Failure',
      expectedSeverity: 'warning',
    },
    {
      id: 'packet_loss',
      backendId: 'packet_loss',
      title: 'Upstream Transit Packet Loss',
      category: 'WAN Impairment',
      description: 'Simulates severe 40% packet loss along upstream ISP backbone causing audio drops and TCP retransmissions.',
      expectedDiagnosis: 'Intermittent Last-Mile Packet Loss',
      expectedSeverity: 'warning',
    },
  ];

  const selectedPreset = scenarios.find((s) => s.id === activeScenario) || scenarios[0];

  const handleExecuteSimulation = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const result = await runSimulation(selectedPreset.backendId);
      setSimulatedSession(result);
    } catch (err: any) {
      setErrorMsg(`Simulation failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const diag = simulatedSession?.diagnosis;
  const tests = simulatedSession?.tests;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
              ⚠️ Controlled Fault Injection Sandbox
            </span>
            <span className="text-xs text-slate-500 font-medium">Safe Innovation Lab</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fault Simulation & Rule Engine Verification Lab
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Inject synthetic edge-case failure profiles to verify how NetExplain's deterministic inference engine detects each bottleneck
          </p>
        </div>

        <button
          type="button"
          onClick={handleExecuteSimulation}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
          <span>Execute Simulation</span>
        </button>
      </div>

      {/* Prominent Safety & Sandbox Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50/80 border-2 border-dashed border-amber-300 text-xs text-amber-950 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">CONTROLLED LAB POLICY: </span>
          All experiments conducted here execute in an isolated software sandbox. Measurements are labeled{' '}
          <span className="font-mono font-bold bg-amber-200/80 px-1 rounded text-amber-900">[SIMULATED]</span>{' '}
          and saved with sandbox attribution. They will never alter your physical adapter configuration or pollute live telemetry.
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Scenario Presets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => {
              setActiveScenario(sc.id);
              setSimulatedSession(null);
            }}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              activeScenario === sc.id
                ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-200'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {sc.category}
            </div>
            <div className="text-xs font-bold text-slate-900 leading-snug mb-2">
              {sc.title}
            </div>
            <StatusBadge variant={sc.expectedSeverity} />
          </button>
        ))}
      </div>

      {/* Scenario Specification Overview */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{selectedPreset.title}</h2>
            <p className="text-xs text-slate-600 mt-0.5">{selectedPreset.description}</p>
          </div>
          <StatusBadge variant={selectedPreset.expectedSeverity} />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span>Targeted Signature: <strong className="text-slate-900">{selectedPreset.expectedDiagnosis}</strong></span>
          <button
            type="button"
            onClick={handleExecuteSimulation}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
          >
            Run This Injection
          </button>
        </div>
      </div>

      {/* Real-Time Simulation Result */}
      {simulatedSession && diag && (
        <div className="bg-white rounded-xl border-2 border-amber-300 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-400 font-mono">
                  SIMULATED RESULT
                </span>
                <StatusBadge variant={diag.severity} />
                <span className="text-xs text-slate-500 font-medium">Confidence: {diag.confidence}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{diag.primary_diagnosis}</h2>
              <p className="text-xs text-slate-600 mt-1">{diag.summary}</p>
            </div>

            <div className="text-right text-xs text-slate-400 font-mono">
              <div>Session: {simulatedSession.session_id}</div>
              <div>Source: {simulatedSession.client_ip}</div>
            </div>
          </div>

          {/* Injected Telemetry Values */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Injected Telemetry Vectors
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              {Object.entries(tests || {}).map(([key, t]) => (
                <div key={key} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="font-semibold text-slate-900 mb-0.5">{t.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mb-1">{t.target}</div>
                  <StatusBadge variant={t.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Hypotheses Tested in Simulation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Rule Engine Hypotheses Verdict
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {diag.hypotheses.map((h, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900">{h.hypothesis}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      h.state === 'supported' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {h.state}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">{h.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
