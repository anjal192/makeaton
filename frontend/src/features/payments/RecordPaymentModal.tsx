import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../api/client';
import { formatMoney, sumMoneyStrings } from '../../lib/money';
import { FormField } from '../../components/FormField';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { CreditCard, X, AlertCircle } from 'lucide-react';
import type { paths } from '../../api/schema';

type Invoice = paths['/invoices']['get']['responses']['200']['content']['application/json']['items'][number];

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onPaymentSuccess?: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}) => {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  // Compute already paid and outstanding balance
  const totalNum = parseFloat(invoice.total || '0');
  const paidAmounts = invoice.payments?.map((p) => p.amount) || [];
  const paidStr = sumMoneyStrings(paidAmounts);
  const paidNum = parseFloat(paidStr);
  const outstandingNum = Math.max(0, totalNum - paidNum);
  const outstandingStr = outstandingNum.toFixed(2);

  const paymentSchema = z.object({
    amount: z
      .string()
      .min(1, 'Amount is required')
      .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal number with at most 2 decimal places')
      .refine((val) => parseFloat(val) > 0, 'Amount must be greater than zero')
      .refine(
        (val) => parseFloat(val) <= outstandingNum + 0.0001,
        `Amount cannot exceed the outstanding balance of ${formatMoney(outstandingStr)}`
      ),
    method: z.enum(['cash', 'card', 'bank_transfer', 'upi']),
  });

  type PaymentFormValues = z.infer<typeof paymentSchema>;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: outstandingStr,
      method: 'card',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (values: PaymentFormValues) => {
    setServerError(null);

    try {
      const { data, error, response } = await api.POST('/invoices/{invoice_id}/payments', {
        params: {
          path: { invoice_id: invoice.id },
        },
        body: {
          amount: values.amount,
          method: values.method,
        },
      });

      if (response.status === 409) {
        const detail = (error as any)?.detail || 'Payment exceeds outstanding balance or invoice is not confirmed.';
        setServerError(detail);
        toast.error(detail);
        return;
      }

      if (error || !data) {
        const detail = (error as any)?.detail || 'Failed to record payment.';
        setServerError(detail);
        toast.error(detail);
        return;
      }

      toast.success(`Payment of ${formatMoney(values.amount)} recorded successfully for Invoice #${invoice.id}!`);
      onPaymentSuccess?.();
      onClose();
    } catch {
      setServerError('Unable to connect to server. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Record Payment for Invoice #{invoice.id}
              </h3>
              <p className="text-xs text-slate-500">Customer ID: #{invoice.customer_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Card */}
        <div className="p-5 bg-slate-50 border-b border-slate-100 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 block">Total</span>
            <span className="text-sm font-semibold text-slate-900">{formatMoney(invoice.total)}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 block">Already Paid</span>
            <span className="text-sm font-semibold text-slate-700">{formatMoney(paidStr)}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-indigo-200 bg-indigo-50/30">
            <span className="text-xs text-indigo-700 block font-medium">Outstanding</span>
            <span className="text-sm font-bold text-indigo-700">{formatMoney(outstandingStr)}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {serverError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <FormField
            label="Payment Amount"
            htmlFor="amount"
            error={errors.amount?.message}
            required
            helperText={`Max payable: ${formatMoney(outstandingStr)}`}
          >
            <div className="flex gap-2">
              <input
                id="amount"
                type="text"
                step="0.01"
                {...register('amount')}
                placeholder="0.00"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setValue('amount', outstandingStr, { shouldValidate: true })}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
              >
                Pay Full
              </button>
            </div>
          </FormField>

          <FormField label="Payment Method" htmlFor="method" error={errors.method?.message} required>
            <select
              id="method"
              {...register('method')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="card">Credit / Debit Card</option>
              <option value="upi">UPI (Instant Payment)</option>
              <option value="bank_transfer">Bank Wire / Transfer</option>
              <option value="cash">Cash / Offline</option>
            </select>
          </FormField>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || outstandingNum <= 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Spinner size="sm" className="text-white" label="Recording..." />
              ) : (
                'Submit Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
