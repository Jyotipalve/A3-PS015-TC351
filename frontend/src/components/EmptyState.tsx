import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  note?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  note,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-white/60">
      <div className="p-3.5 rounded-full bg-slate-100/80 text-slate-500 mb-3 border border-slate-200">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium bg-sky-700 text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition-colors cursor-pointer shadow-xs"
        >
          {action.label}
        </button>
      )}

      {note && (
        <span className="text-[11px] text-slate-400 mt-2 font-mono">
          {note}
        </span>
      )}
    </div>
  );
};
