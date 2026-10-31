import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { DataTable, type Column } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { MoneyText } from '../../components/MoneyText';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime, capitalize } from '../../lib/format';
import { sumMoneyStrings } from '../../lib/money';
import { RecordPaymentModal } from './RecordPaymentModal';
import {
  Search,
  Filter,
  PlusCircle,
  Receipt,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import type { paths } from '../../api/schema';

type Invoice = paths['/invoices']['get']['responses']['200']['content']['application/json']['items'][number];
type Payment = NonNullable<Invoice['payments']>[number];

interface FlatPaymentRow extends Payment {
  invoiceTotal: string;
  invoiceStatus: string;
  customerId: number;
  periodEnd: string;
  invoiceRef: Invoice;
}

export const PaymentsListPage: React.FC = () => {
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  // TanStack Query to fetch invoices
  const {
    data: invoicesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['invoices-payments', page, pageSize],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices', {
        params: {
          query: {
            page,
            page_size: pageSize,
          },
        },
      });
      if (error) throw new Error((error as any)?.detail || 'Failed to fetch invoices');
      return data;
    },
    placeholderData: (prev) => prev,
  });

  // Extract and flatten payments from invoices
  const allPayments: FlatPaymentRow[] = useMemo(() => {
    if (!invoicesData?.items) return [];
    const rows: FlatPaymentRow[] = [];
    for (const inv of invoicesData.items) {
      if (inv.payments && inv.payments.length > 0) {
        for (const p of inv.payments) {
          rows.push({
            ...p,
            invoiceTotal: inv.total,
            invoiceStatus: inv.status,
            customerId: inv.customer_id,
            periodEnd: inv.period_end,
            invoiceRef: inv,
          });
        }
      }
    }
    // Sort latest payments first
    return rows.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  }, [invoicesData]);

  // Client-side filtering by search and method
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      const matchesSearch =
        searchTerm === '' ||
        p.id.toString().includes(searchTerm) ||
        p.invoice_id.toString().includes(searchTerm) ||
        p.customerId.toString().includes(searchTerm);

      const matchesMethod = methodFilter === 'all' || p.method === methodFilter;

      return matchesSearch && matchesMethod;
    });
  }, [allPayments, searchTerm, methodFilter]);

  // Invoices eligible for recording new payments (status === "confirmed" and outstanding > 0)
  const payableInvoices = useMemo(() => {
    if (!invoicesData?.items) return [];
    return invoicesData.items.filter((inv) => {
      if (inv.status !== 'confirmed') return false;
      const totalNum = parseFloat(inv.total || '0');
      const paidStr = sumMoneyStrings(inv.payments?.map((p) => p.amount) || []);
      const paidNum = parseFloat(paidStr);
      return totalNum - paidNum > 0.001;
    });
  }, [invoicesData]);

  // Aggregate stats
  const totalCollected = useMemo(() => {
    return sumMoneyStrings(filteredPayments.map((p) => p.amount));
  }, [filteredPayments]);

  const columns: Column<FlatPaymentRow>[] = [
    {
      header: 'Payment ID',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          #PAY-{row.id}
        </span>
      ),
    },
    {
      header: 'Invoice',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs text-indigo-600 font-medium">
            #INV-{row.invoice_id}
          </span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (row) => (
        <span className="text-xs text-slate-600">Cust #{row.customerId}</span>
      ),
    },
    {
      header: 'Amount Paid',
      accessor: (row) => (
        <MoneyText amount={row.amount} variant="positive" className="text-sm font-semibold" />
      ),
    },
    {
      header: 'Method',
      accessor: (row) => {
        const methodLabels: Record<string, string> = {
          card: 'Credit/Debit Card',
          upi: 'UPI',
          bank_transfer: 'Bank Transfer',
          cash: 'Cash',
        };
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {methodLabels[row.method] || capitalize(row.method)}
          </span>
        );
      },
    },
    {
      header: 'Paid At',
      accessor: (row) => (
        <span className="text-xs text-slate-500">{formatDateTime(row.paid_at)}</span>
      ),
    },
    {
      header: 'Invoice Status',
      accessor: (row) => <StatusBadge status={row.invoiceStatus} />,
    },
  ];

  const canRecordPayment = role === 'admin' || role === 'staff';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments & Collections</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track customer transactions and settle confirmed invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {canRecordPayment && (
            <div className="relative">
              {payableInvoices.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(payableInvoices[0])}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-2xs transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Record Payment ({payableInvoices.length} open)</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg border border-slate-200 cursor-not-allowed"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>No Confirmed Invoices Pending</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Total Collected (Current View)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <MoneyText amount={totalCollected} variant="positive" className="text-2xl font-bold" />
            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Across filtered transactions</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Transactions Logged
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {filteredPayments.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Completed payments</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Unsettled Confirmed Invoices
          </span>
          <div className="mt-2 text-2xl font-bold text-indigo-600">
            {payableInvoices.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Awaiting payment</span>
        </div>
      </div>

      {/* Actionable Confirmed Invoices Banner for Admin/Staff */}
      {canRecordPayment && payableInvoices.length > 0 && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              {payableInvoices.length}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-indigo-950">
                Confirmed Invoices Ready for Payment Settlement
              </h4>
              <p className="text-xs text-indigo-700">
                Click any open invoice below or select from the list to record a partial or full payment.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {payableInvoices.slice(0, 3).map((inv) => (
              <button
                key={inv.id}
                onClick={() => setSelectedInvoiceForPayment(inv)}
                className="px-3 py-1 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-md transition shadow-2xs"
              >
                #INV-{inv.id} ({inv.total})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Payment, Invoice, or Customer ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Method:</span>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Methods</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </div>

      {/* Payments Data Table */}
      <DataTable
        columns={columns}
        data={filteredPayments}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={() => refetch()}
        emptyTitle="No payments recorded"
        emptyDescription={
          searchTerm || methodFilter !== 'all'
            ? 'No payments match your filter criteria.'
            : 'No payments have been recorded in the system yet. Once invoices are confirmed and settled, payment receipts appear here.'
        }
      />

      {/* Pagination */}
      {invoicesData && (
        <Pagination
          page={invoicesData.page}
          pageSize={invoicesData.page_size}
          total={invoicesData.total}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          isLoading={isFetching}
        />
      )}

      {/* Record Payment Modal */}
      {selectedInvoiceForPayment && (
        <RecordPaymentModal
          isOpen={Boolean(selectedInvoiceForPayment)}
          invoice={selectedInvoiceForPayment}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onPaymentSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};
