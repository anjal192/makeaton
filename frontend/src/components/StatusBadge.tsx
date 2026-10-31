import React from 'react';
import clsx from 'clsx';
import { formatStatus } from '../lib/format';

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  if (!status) return <span className="text-slate-400">—</span>;

  const s = status.toLowerCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (s === 'paid' || s === 'active' || s === 'confirmed') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'draft' || s === 'quotation') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (s === 'overdue' || s === 'cancelled' || s === 'expired') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (s === 'closed') {
    colorClasses = 'bg-slate-100 text-slate-600 border-slate-300';
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
        colorClasses,
        className
      )}
    >
      {formatStatus(status)}
    </span>
  );
};
