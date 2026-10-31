import React from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className={clsx('flex items-center justify-center gap-2 text-indigo-600', className)}>
      <Loader2 className={clsx('animate-spin', sizeClasses[size])} />
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </div>
  );
};
