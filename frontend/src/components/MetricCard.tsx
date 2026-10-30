import React from 'react';
import {
  Wifi,
  Activity,
  Layers,
  Globe,
  Radio,
  Server,
  Zap,
  HelpCircle,
  LucideIcon,
  Clock,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';

const iconMap: Record<string, LucideIcon> = {
  wifi: Wifi,
  activity: Activity,
  layers: Layers,
  globe: Globe,
  radio: Radio,
  server: Server,
  zap: Zap,
};

interface MetricCardProps {
  title: string;
  subtitle: string;
  iconName: string;
  value: string | number | null | undefined;
  unit?: string;
  status: string;
  statusText?: string;
  target?: string;
  detail?: string;
  lastTested?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  subtitle,
  iconName,
  value,
  unit,
  status,
  statusText,
  target,
  detail,
  lastTested,
}) => {
  const IconComponent = iconMap[iconName] || HelpCircle;

  // Crucial requirement: Null values must NEVER appear as 0!
  const hasValue = value !== null && value !== undefined && value !== '';
  const displayValue = hasValue ? value : 'Not measured yet';

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-sky-700">
              <IconComponent className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <StatusBadge variant={status} label={statusText} />
        </div>

        {/* Metric Value Display */}
        <div className="my-3">
          {hasValue ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {displayValue}
              </span>
              {unit && (
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  {unit}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-400 italic">
              Not measured yet
            </div>
          )}

          {target && (
            <div className="mt-1 text-[11px] text-slate-500 font-mono truncate">
              Target: <span className="text-slate-700">{target}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
        {detail && <div className="text-slate-600 line-clamp-1">{detail}</div>}
        <div className="flex items-center justify-between text-slate-400">
          <span>{lastTested ? `Tested: ${lastTested}` : 'Awaiting diagnosis'}</span>
          <Clock className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
};
