import React, { useState, useEffect } from 'react';
import { NetworkPath } from '../components/NetworkPath';
import { TelemetryGlobe } from '../components/TelemetryGlobe';
import { fetchDiagnosisHistory } from '../api/client';
import { DiagnosticSession } from '../types';
import { Wifi, Globe, Cloud, Layers } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

export const NetworkPathPage: React.FC = () => {
  const [latestSession, setLatestSession] = useState<DiagnosticSession | null>(null);

  useEffect(() => {
    fetchDiagnosisHistory(1).then((data) => {
      if (data && data.length > 0) {
        setLatestSession(data[0]);
      }
    }).catch(() => {});
  }, []);

  const tests = latestSession?.tests;
  const gwVal = tests?.gateway?.measured_values;
  const dnsVal = tests?.dns?.measured_values;
  const icmpVal = tests?.external_icmp?.measured_values;
  const httpVal = tests?.external_http?.measured_values;
  const loadVal = tests?.mild_load?.measured_values;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Network Path & Topology Inspection
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Trace physical routing hops and application directory layers between your host and the Internet
        </p>
      </div>

      {/* 3D Global Telemetry Globe */}
      <TelemetryGlobe
        session={latestSession}
        tests={tests}
        height={320}
        title="Geospatial Telemetry Topography"
        subtitle="3D visualization of routing propagation and latency hops from home client"
      />

      {/* Main Interactive Path Component */}
      <NetworkPath tests={tests} />

      {/* Detailed Hop-by-Hop Telemetry Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hop 1: Local Device & Gateway */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hop 1: Local Gateway (LAN / Wi-Fi)</h2>
              <span className="text-[11px] text-slate-500 font-mono">Physical Link Layer</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Measures latency between your device NIC and the default home router or ONT access gateway.
          </p>
          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Gateway Address:</span>
              <span className="font-mono font-medium text-slate-800">{gwVal?.gateway_ip || 'Auto-detect'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Average RTT:</span>
              <span className="font-mono font-medium text-slate-800">{gwVal?.rtt_avg_ms !== undefined ? `${gwVal.rtt_avg_ms}ms` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Packet Loss:</span>
              <span className="font-mono font-medium text-slate-800">{gwVal?.packet_loss_pct !== undefined ? `${gwVal.packet_loss_pct}%` : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Hop State:</span>
              <StatusBadge variant={tests?.gateway?.status || 'pending'} />
            </div>
          </div>
        </div>

        {/* Hop 2: DNS Resolver Service */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Directory: DNS Name Resolution</h2>
              <span className="text-[11px] text-sky-800 font-medium">Logical Application Service</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Translates human hostnames into IP routing addresses. Slow resolvers cause web pages to hesitate before loading.
          </p>
          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Tested Hostname:</span>
              <span className="font-mono font-medium text-slate-800">{dnsVal?.hostname || 'google.com'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Resolution Time:</span>
              <span className="font-mono font-medium text-slate-800">{dnsVal?.resolution_time_ms !== undefined ? `${dnsVal.resolution_time_ms}ms` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IPs Discovered:</span>
              <span className="font-mono font-medium text-slate-800">{dnsVal?.ip_count || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Resolver State:</span>
              <StatusBadge variant={tests?.dns?.status || 'pending'} />
            </div>
          </div>
        </div>

        {/* Hop 3: External IP Edge */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hop 2: Internet Edge & Peering</h2>
              <span className="text-[11px] text-slate-500 font-mono">Transit Route</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Measures ICMP round-trip latency and packet delivery through your ISP backbone to global cloud infrastructure.
          </p>
          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Target IP:</span>
              <span className="font-mono font-medium text-slate-800">{icmpVal?.target || '1.1.1.1'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transit Latency:</span>
              <span className="font-mono font-medium text-slate-800">{icmpVal?.rtt_avg_ms !== undefined ? `${icmpVal.rtt_avg_ms}ms` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">HTTP Response:</span>
              <span className="font-mono font-medium text-slate-800">{httpVal?.status_code ? `HTTP ${httpVal.status_code}` : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Edge State:</span>
              <StatusBadge variant={tests?.external_icmp?.status || 'pending'} />
            </div>
          </div>
        </div>

        {/* Hop 4: Mild-Load Bufferbloat */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hop 3: Last-Mile Queue (Bufferbloat)</h2>
              <span className="text-[11px] text-slate-500 font-mono">Active Queue Behavior</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Detects unmanaged router buffer queuing under non-saturating download conditions.
          </p>
          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Idle Baseline:</span>
              <span className="font-mono font-medium text-slate-800">{loadVal?.baseline_rtt_ms !== undefined ? `${loadVal.baseline_rtt_ms}ms` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Loaded RTT:</span>
              <span className="font-mono font-medium text-slate-800">{loadVal?.loaded_rtt_ms !== undefined ? `${loadVal.loaded_rtt_ms}ms` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Queue Latency Delta:</span>
              <span className="font-mono font-bold text-slate-900">{loadVal?.delta_ms !== undefined ? `+${loadVal.delta_ms}ms` : '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Bufferbloat State:</span>
              <StatusBadge variant={tests?.mild_load?.status || 'pending'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
