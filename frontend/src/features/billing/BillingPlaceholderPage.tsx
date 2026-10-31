import React from 'react';
import { Repeat, Receipt, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface BillingPlaceholderProps {
  title: string;
  section: 'subscriptions' | 'invoices' | 'templates';
  endpoints: string[];
}

export const BillingPlaceholderPage: React.FC<BillingPlaceholderProps> = ({
  title,
  section,
  endpoints,
}) => {
  const { role } = useAuth();

  const icons = {
    subscriptions: <Repeat className="w-8 h-8 text-indigo-600" />,
    invoices: <Receipt className="w-8 h-8 text-indigo-600" />,
    templates: <FileSpreadsheet className="w-8 h-8 text-indigo-600" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">Billing Module • Member C</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-8 shadow-2xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          {icons[section]}
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{title} Screen</h2>
        <p className="text-sm text-slate-600 mb-6">
          This area is designated for <strong>Member C (Billing Lead)</strong> for subscription lifecycles, quotation workflows, and invoice generation.
        </p>

        {role === 'customer' ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 text-left">
            <p className="font-semibold">Customer View Active</p>
            <p className="mt-1">Backend automatically filters records to only show your account's subscriptions and invoices.</p>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">Associated Backend Endpoints:</p>
            <ul className="list-disc list-inside space-y-1 font-mono text-indigo-700">
              {endpoints.map((ep, i) => (
                <li key={i}>{ep}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
