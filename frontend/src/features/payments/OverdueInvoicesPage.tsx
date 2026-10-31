import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { DataTable, type Column } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { MoneyText } from '../../components/MoneyText';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../lib/format';
import { sumMoneyStrings } from '../../lib/money';
import { RecordPaymentModal } from './RecordPaymentModal';
import {
  AlertTriangle,
  Receipt,
  ArrowUpDown,
  CreditCard,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { paths } from '../../api/schema';

type Invoice = paths['/invoices']['get']['responses']['200']['content']['application/json']['items'][number];

interface OutstandingInvoiceRow extends Invoice {
  paidAmountStr: string;
  outstandingStr: string;
  outstandingNum: number;
  isOverdue: boolean;
  daysDiff: number;
}

export const OverdueInvoicesPage: React.FC = () => {
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'due_date' | 'outstanding' | 'id'>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const {
    data: invoicesData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['invoices-outstanding', page, pageSize],
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

  const now = useMemo(() => new Date(), []);

  // Process rows with calculations
  const processedRows: OutstandingInvoiceRow[] = useMemo(() => {
    if (!invoicesData?.items) return [];

    return invoicesData.items
      .map((inv) => {
        const totalNum = parseFloat(inv.total || '0');
        const paidStr = sumMoneyStrings(inv.payments?.map((p) => p.amount) || []);
        const paidNum = parseFloat(paidStr);
        const outstandingNum = Math.max(0, totalNum - paidNum);
        const dueDate = new Date(inv.due_date);
        const isOverdue = dueDate < now && outstandingNum > 0.001 && inv.status !== 'cancelled';
        const daysDiff = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...inv,
          paidAmountStr: paidStr,
          outstandingStr: outstandingNum.toFixed(2),
          outstandingNum,
          isOverdue,
          daysDiff,
        };
      })
      .filter((inv) => inv.outstandingNum > 0.001); // only show those with positive outstanding balance
  }, [invoicesData, now]);

  // Filter and sort
  const filteredAndSortedRows = useMemo(() => {
    let result = [...processedRows];

    if (onlyOverdueFilter) {
      result = result.filter((r) => r.isOverdue);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toString().includes(term) ||
          r.customer_id.toString().includes(term) ||
          r.subscription_id.toString().includes(term)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'due_date') {
        cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else if (sortBy === 'outstanding') {
        cmp = a.outstandingNum - b.outstandingNum;
      } else {
        cmp = a.id - b.id;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [processedRows, onlyOverdueFilter, searchTerm, sortBy, sortDirection]);

  // Aggregate sums
  const totalOutstanding = useMemo(() => {
    return sumMoneyStrings(filteredAndSortedRows.map((r) => r.outstandingStr));
  }, [filteredAndSortedRows]);

  const overdueCount = useMemo(() => {
    return processedRows.filter((r) => r.isOverdue).length;
  }, [processedRows]);

  const totalOverdueAmount = useMemo(() => {
    return sumMoneyStrings(processedRows.filter((r) => r.isOverdue).map((r) => r.outstandingStr));
  }, [processedRows]);

  const toggleSort = (field: 'due_date' | 'outstanding' | 'id') => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const canRecordPayment = role === 'admin' || role === 'staff';

  const columns: Column<OutstandingInvoiceRow>[] = [
    {
      header: 'Invoice',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs font-semibold text-slate-900">
            #INV-{row.id}
          </span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (row) => (
        <span className="text-xs text-slate-600">Cust #{row.customer_id}</span>
      ),
    },
    {
      header: 'Subscription',
      accessor: (row) => (
        <span className="text-xs text-slate-600 font-mono">#SUB-{row.subscription_id}</span>
      ),
    },
    {
      header: 'Due Date',
      accessor: (row) => (
        <div className="flex flex-col">
          <span
            className={`text-xs font-semibold ${
              row.isOverdue ? 'text-rose-600' : 'text-slate-800'
            }`}
          >
            {formatDate(row.due_date)}
          </span>
          {row.isOverdue ? (
            <span className="text-[10px] text-rose-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {Math.abs(row.daysDiff)} days overdue
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">
              {row.daysDiff === 0 ? 'Due today' : `Due in ${row.daysDiff} days`}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Total',
      accessor: (row) => <MoneyText amount={row.total} className="text-xs" />,
    },
    {
      header: 'Paid',
      accessor: (row) => <MoneyText amount={row.paidAmountStr} variant="muted" className="text-xs" />,
    },
    {
      header: 'Outstanding Balance',
      accessor: (row) => (
        <MoneyText
          amount={row.outstandingStr}
          variant={row.isOverdue ? 'negative' : 'default'}
          className="text-sm font-bold"
        />
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.isOverdue ? 'overdue' : row.status} />,
    },
    {
      header: 'Action',
      accessor: (row) => {
        if (!canRecordPayment) return null;
        if (row.status !== 'confirmed') {
          return (
            <span className="text-xs text-slate-400 italic">
              Needs confirmation
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => setSelectedInvoice(row)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-md border border-indigo-200 transition"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pay</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Outstanding & Overdue Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor unsettled accounts receivable and prioritize overdue collections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Total Outstanding Balance
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            <MoneyText amount={totalOutstanding} />
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Unpaid across active invoices</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
          <span className="text-xs font-medium text-rose-700 uppercase tracking-wider block">
            Total Overdue Balance
          </span>
          <div className="mt-2 text-2xl font-bold text-rose-600">
            <MoneyText amount={totalOverdueAmount} variant="negative" />
          </div>
          <span className="text-xs text-rose-600/70 mt-1 block">{overdueCount} overdue invoices</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Open Invoices Count
          </span>
          <div className="mt-2 text-2xl font-bold text-indigo-600">
            {processedRows.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">With non-zero balance</span>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Invoice, Customer, or Sub ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyOverdueFilter}
              onChange={(e) => setOnlyOverdueFilter(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className={onlyOverdueFilter ? 'text-rose-600 font-semibold' : ''}>
              Show Only Overdue ({overdueCount})
            </span>
          </label>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort by:</span>
            <button
              onClick={() => toggleSort('due_date')}
              className={`px-2 py-1 rounded font-medium transition ${
                sortBy === 'due_date'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Due Date {sortBy === 'due_date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
              onClick={() => toggleSort('outstanding')}
              className={`px-2 py-1 rounded font-medium transition ${
                sortBy === 'outstanding'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Amount {sortBy === 'outstanding' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredAndSortedRows}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
        onRetry={() => refetch()}
        emptyTitle={onlyOverdueFilter ? 'No overdue invoices' : 'No outstanding balances'}
        emptyDescription={
          onlyOverdueFilter
            ? 'All invoices are paid or within their allowable payment terms!'
            : 'All issued invoices have been fully settled.'
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

      {/* Payment Modal */}
      {selectedInvoice && (
        <RecordPaymentModal
          isOpen={Boolean(selectedInvoice)}
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaymentSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};
