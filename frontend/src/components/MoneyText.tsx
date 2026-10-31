import React from 'react';
import clsx from 'clsx';
import { formatMoney } from '../lib/money';

interface MoneyTextProps {
  amount: string | number | null | undefined;
  className?: string;
  variant?: 'default' | 'positive' | 'negative' | 'muted';
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  amount,
  className,
  variant = 'default',
}) => {
  const formatted = formatMoney(amount);

  const variantClasses = {
    default: 'text-slate-900 font-medium',
    positive: 'text-emerald-600 font-semibold',
    negative: 'text-rose-600 font-semibold',
    muted: 'text-slate-500',
  };

  return <span className={clsx(variantClasses[variant], className)}>{formatted}</span>;
};
