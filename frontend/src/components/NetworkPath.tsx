import React from 'react';
import { Laptop, Wifi, Globe, Cloud, ArrowRight, Info } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { SingleTestResult } from '../types';

interface NetworkPathProps {
  tests?: Record<string, SingleTestResult>;
}

export const NetworkPath: React.FC<NetworkPathProps> = ({ tests }) => {
  const gwTest = tests?.gateway;
  const dnsTest = tests?.dns;
  const icmpTest = tests?.external_icmp;
  const httpTest = tests?.external_http;

  const gwStatus = gwTest?.status || 'pending';
  const dnsStatus = dnsTest?.status || 'pending';
  
  // Combined external status
  let extStatus = 'pending';
  if (icmpTest?.status === 'running' || httpTest?.status === 'running') {
    extStatus = 'running';
  } else if (icmpTest?.status === 'fail' && httpTest?.status === 'fail') {
    extStatus = 'fail';
  } else if (icmpTest?.status === 'warning' || httpTest?.status === 'warning') {
    extStatus = 'warning';
  } else if (icmpTest?.status === 'pass' || httpTest?.status === 'pass') {
    extStatus = 'pass';
  } else if (icmpTest?.status === 'inconclusive' || httpTest?.status === 'inconclusive') {
    extStatus = 'inconclusive';
  }

  const nodes = [
    {
      id: 'device',
      name: 'Client Device',
      role: 'Local Host',
      type: 'physical',
      status: 'pass', // local host running the browser is active
      statusLabel: 'Host Active',
      icon: <Laptop className="h-5 w-5" />,
      detail: 'NIC & OS Network Stack',
    },
    {
      id: 'gateway',
      name: 'Default Gateway',
      role: 'LAN / Home Router',
      type: 'physical',
      status: gwStatus,
      statusLabel: gwStatus === 'pending' ? 'Not tested' : gwStatus,
      icon: <Wifi className="h-5 w-5" />,
      detail: gwTest?.measured_values?.gateway_ip 
        ? `${gwTest.measured_values.gateway_ip} (${gwTest.measured_values.rtt_avg_ms !== null && gwTest.measured_values.rtt_avg_ms !== undefined ? gwTest.measured_values.rtt_avg_ms + 'ms' : 'No RTT'})` 
        : 'Local router IP hop',
    },
    {
      id: 'dns',
      name: 'DNS Resolver',
      role: 'Resolution Service',
      type: 'logical',
      status: dnsStatus,
      statusLabel: dnsStatus === 'pending' ? 'Not tested' : dnsStatus,
      icon: <Globe className="h-5 w-5" />,
      detail: dnsTest?.measured_values?.resolution_time_ms !== null && dnsTest?.measured_values?.resolution_time_ms !== undefined
        ? `Lookup: ${dnsTest.measured_values.resolution_time_ms}ms`
        : 'Logical directory service',
      isLogicalNotice: true,
    },
    {
      id: 'external',
      name: 'External Endpoint',
      role: 'Internet Edge / CDN',
      type: 'physical',
      status: extStatus,
      statusLabel: extStatus === 'pending' ? 'Not tested' : extStatus,
      icon: <Cloud className="h-5 w-5" />,
      detail: icmpTest?.measured_values?.rtt_avg_ms !== null && icmpTest?.measured_values?.rtt_avg_ms !== undefined
        ? `Edge: ${icmpTest.measured_values.rtt_avg_ms}ms`
        : 'Public edge verify',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">End-to-End Diagnostic Path</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical routing hops and logical directory services mapped to observed telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Path State:</span>
          <StatusBadge
            variant={extStatus === 'pass' && gwStatus === 'pass' ? 'healthy' : gwStatus === 'fail' || extStatus === 'fail' ? 'critical' : 'pending'}
            label={extStatus === 'pass' && gwStatus === 'pass' ? 'Verified Reachable' : gwStatus === 'fail' ? 'Severed at Gateway' : 'Awaiting Full Telemetry'}
          />
        </div>
      </div>

      {/* Nodes Map */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative my-4">
        {nodes.map((node, index) => {
          const isLogical = node.isLogicalNotice;
          return (
            <React.Fragment key={node.id}>
              <div
                className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${
                  node.status === 'pass'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : node.status === 'fail'
                    ? 'border-rose-300 bg-rose-50/30'
                    : node.status === 'warning'
                    ? 'border-amber-200 bg-amber-50/20'
                    : node.status === 'running'
                    ? 'border-sky-300 bg-sky-50/30 ring-2 ring-sky-200'
                    : 'border-slate-200/90 bg-slate-50/50'
                }`}
              >
                <div
                  className={`p-3 rounded-xl border shadow-2xs mb-2.5 ${
                    node.status === 'pass'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : node.status === 'fail'
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : node.status === 'running'
                      ? 'bg-sky-50 border-sky-200 text-sky-700 animate-pulse'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {node.icon}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 leading-tight">
                    {node.name}
                  </span>
                </div>

                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mt-0.5 mb-2">
                  {node.role}
                </span>

                <StatusBadge variant={node.status} label={node.statusLabel} className="my-1" />

                <p className="text-[11px] text-slate-600 mt-2 font-mono">
                  {node.detail}
                </p>

                {isLogical && (
                  <span className="mt-2 text-[10px] text-sky-800 bg-sky-50 border border-sky-200/60 rounded px-1.5 py-0.5">
                    Application service
                  </span>
                )}
              </div>

              {/* Connecting Chevron on Desktop */}
              {index < nodes.length - 1 && (
                <div
                  className="hidden md:flex absolute top-1/2 -translate-y-1/2 justify-center items-center pointer-events-none z-10"
                  style={{ left: `calc(${((index + 1) * 25)}% - 12px)` }}
                >
                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Crucial architectural note: DNS is not a physical hop */}
      <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
        <Info className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Architectural Note on Routing vs. Services: </span>
          DNS Resolver is an application-layer name translation service queried over UDP/TCP port 53. It is not an in-line physical routing gateway. Traffic to the Internet flows physically through your Default Gateway to ISP peering nodes, while DNS queries resolve destination domain names.
        </div>
      </div>
    </div>
  );
};
