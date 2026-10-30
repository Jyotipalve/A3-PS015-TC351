import React from 'react';

export type BadgeVariant =
  | 'pending'
  | 'running'
  | 'pass'
  | 'fail'
  | 'warning'
  | 'inconclusive'
  | 'healthy'
  | 'critical'
  | 'offline'
  | 'info'
  | 'completed';

interface StatusBadgeProps {
  variant: string;
  label?: string;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<string, { bg: string; text: string; dotColor: string; border: string }> = {
  pending: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dotColor: 'bg-slate-400',
    border: 'border-slate-200',
  },
  running: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    dotColor: 'bg-sky-500 animate-ping',
    border: 'border-sky-300',
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  pass: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  healthy: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dotColor: 'bg-amber-500',
    border: 'border-amber-200',
  },
  fail: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dotColor: 'bg-rose-500',
    border: 'border-rose-200',
  },
  critical: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dotColor: 'bg-rose-500',
    border: 'border-rose-200',
  },
  inconclusive: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    dotColor: 'bg-purple-400',
    border: 'border-purple-200',
  },
  offline: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dotColor: 'bg-slate-400',
    border: 'border-slate-200',
  },
  info: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    dotColor: 'bg-sky-500',
    border: 'border-sky-200',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  className = '',
  dot = true,
}) => {
  const normVariant = variant ? variant.toLowerCase() : 'pending';
  const styles = variantStyles[normVariant] || variantStyles.pending;
  const displayLabel = label || normVariant.charAt(0).toUpperCase() + normVariant.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${styles.dotColor}`}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
