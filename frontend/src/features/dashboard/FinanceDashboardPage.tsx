import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { MoneyText } from '../../components/MoneyText';
import { StatusBadge } from '../../components/StatusBadge';
import { DataTable, type Column } from '../../components/DataTable';
import { Spinner } from '../../components/Spinner';
import { formatDate } from '../../lib/format';
import { sumMoneyStrings } from '../../lib/money';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Filter,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import type { paths } from '../../api/schema';

type Invoice = paths['/invoices']['get']['responses']['200']['content']['application/json']['items'][number];
type Subscription = paths['/subscriptions']['get']['responses']['200']['content']['application/json']['items'][number];

const STATUS_COLORS: Record<string, string> = {
  paid: '#10b981', // emerald-500
  confirmed: '#6366f1', // indigo-500
  draft: '#f59e0b', // amber-500
  cancelled: '#94a3b8', // slate-400
};

const METHOD_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b'];

export const FinanceDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters stored in URL query params
  const statusFilter = searchParams.get('status') || 'all';
  const timeRange = searchParams.get('range') || 'all'; // 'all', '30d', '90d', 'year'

  const updateFilter = (key: string, val: string) => {
    const updated = new URLSearchParams(searchParams);
    if (val === 'all') {
      updated.delete(key);
    } else {
      updated.set(key, val);
    }
    setSearchParams(updated);
  };

  // Fetch invoices for finance metrics
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    isFetching,
    refetch: refetchInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const { data, error } = await api.GET('/invoices', {
        params: {
          query: {
            page: 1,
            page_size: 100,
          },
        },
      });
      if (error) throw new Error((error as any)?.detail || 'Failed to load invoice metrics');
      return data;
    },
  });

  // Fetch subscriptions for active contracts metric
  const {
    data: subscriptionsData,
    isLoading: subscriptionsLoading,
    refetch: refetchSubscriptions,
  } = useQuery({
    queryKey: ['dashboard-subscriptions'],
    queryFn: async () => {
      const { data, error } = await api.GET('/subscriptions', {
        params: {
          query: {
            page: 1,
            page_size: 100,
          },
        },
      });
      if (error) throw new Error((error as any)?.detail || 'Failed to load subscriptions');
      return data;
    },
  });

  const refetchAll = () => {
    refetchInvoices();
    refetchSubscriptions();
  };

  const now = useMemo(() => new Date(), []);

  // Filter invoices based on URL parameters
  const filteredInvoices = useMemo(() => {
    if (!invoicesData?.items) return [];
    let items = [...invoicesData.items];

    if (statusFilter !== 'all') {
      items = items.filter((inv) => inv.status === statusFilter);
    }

    if (timeRange !== 'all') {
      const cutoff = new Date();
      if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
      else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
      else if (timeRange === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);

      items = items.filter((inv) => new Date(inv.created_at) >= cutoff);
    }

    return items;
  }, [invoicesData, statusFilter, timeRange]);

  // Aggregate Metrics Calculations
  const metrics = useMemo(() => {
    if (!filteredInvoices) {
      return {
        totalInvoiced: '0.00',
        totalCollected: '0.00',
        totalOutstanding: '0.00',
        totalOverdue: '0.00',
        overdueCount: 0,
        activeSubscriptionsCount: 0,
      };
    }

    let totalInvoicedPaise = 0;
    let totalCollectedPaise = 0;
    let totalOutstandingPaise = 0;
    let totalOverduePaise = 0;
    let overdueCount = 0;

    for (const inv of filteredInvoices) {
      const invTotalNum = parseFloat(inv.total || '0');
      const paidStr = sumMoneyStrings(inv.payments?.map((p) => p.amount) || []);
      const paidNum = parseFloat(paidStr);
      const outstandingNum = Math.max(0, invTotalNum - paidNum);

      totalInvoicedPaise += Math.round(invTotalNum * 100);
      totalCollectedPaise += Math.round(paidNum * 100);
      totalOutstandingPaise += Math.round(outstandingNum * 100);

      const isOverdue =
        new Date(inv.due_date) < now && outstandingNum > 0.001 && inv.status !== 'cancelled';
      if (isOverdue) {
        totalOverduePaise += Math.round(outstandingNum * 100);
        overdueCount++;
      }
    }

    const activeSubs =
      subscriptionsData?.items?.filter(
        (s: Subscription) => s.status === 'active' || s.status === 'confirmed'
      ).length || 0;

    return {
      totalInvoiced: (totalInvoicedPaise / 100).toFixed(2),
      totalCollected: (totalCollectedPaise / 100).toFixed(2),
      totalOutstanding: (totalOutstandingPaise / 100).toFixed(2),
      totalOverdue: (totalOverduePaise / 100).toFixed(2),
      overdueCount,
      activeSubscriptionsCount: activeSubs,
    };
  }, [filteredInvoices, now, subscriptionsData]);

  // Chart Data: Status Distribution
  const statusChartData = useMemo(() => {
    if (!filteredInvoices) return [];
    const counts: Record<string, number> = {
      draft: 0,
      confirmed: 0,
      paid: 0,
      cancelled: 0,
    };
    for (const inv of filteredInvoices) {
      if (counts[inv.status] !== undefined) {
        counts[inv.status]++;
      }
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      key: name,
    }));
  }, [filteredInvoices]);

  // Chart Data: Invoiced vs Collected (Monthly or Timeline)
  const timelineChartData = useMemo(() => {
    if (!filteredInvoices.length) return [];

    const monthMap = new Map<string, { month: string; invoiced: number; collected: number }>();

    for (const inv of filteredInvoices) {
      const d = new Date(inv.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      if (!monthMap.has(key)) {
        monthMap.set(key, { month: monthLabel, invoiced: 0, collected: 0 });
      }

      const entry = monthMap.get(key)!;
      entry.invoiced += parseFloat(inv.total || '0');
      const paid = sumMoneyStrings(inv.payments?.map((p) => p.amount) || []);
      entry.collected += parseFloat(paid);
    }

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => ({
        month: val.month,
        invoiced: Math.round(val.invoiced),
        collected: Math.round(val.collected),
      }));
  }, [filteredInvoices]);

  // Chart Data: Payment Methods Breakdown
  const methodChartData = useMemo(() => {
    if (!filteredInvoices.length) return [];
    const methodTotals: Record<string, number> = {
      card: 0,
      upi: 0,
      bank_transfer: 0,
      cash: 0,
    };
    for (const inv of filteredInvoices) {
      if (inv.payments) {
        for (const p of inv.payments) {
          const amt = parseFloat(p.amount || '0');
          if (methodTotals[p.method] !== undefined) {
            methodTotals[p.method] += amt;
          }
        }
      }
    }

    return Object.entries(methodTotals)
      .filter(([, val]) => val > 0)
      .map(([method, val]) => {
        const labels: Record<string, string> = {
          card: 'Cards',
          upi: 'UPI',
          bank_transfer: 'Bank Wire',
          cash: 'Cash',
        };
        return {
          name: labels[method] || method,
          amount: Math.round(val),
        };
      });
  }, [filteredInvoices]);

  // Recent Invoices Table
  const recentInvoices = useMemo(() => {
    return [...filteredInvoices]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [filteredInvoices]);

  const recentColumns: Column<Invoice>[] = [
    {
      header: 'Invoice',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          #INV-{row.id}
        </span>
      ),
    },
    {
      header: 'Customer',
      accessor: (row) => (
        <span className="text-xs text-slate-600">Cust #{row.customer_id}</span>
      ),
    },
    {
      header: 'Due Date',
      accessor: (row) => (
        <span className="text-xs text-slate-700">{formatDate(row.due_date)}</span>
      ),
    },
    {
      header: 'Total',
      accessor: (row) => <MoneyText amount={row.total} className="text-xs font-semibold" />,
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const isLoading = invoicesLoading || subscriptionsLoading;

  if (isLoading && !invoicesData) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Spinner size="lg" label="Loading financial analytics..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance & Billing Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tracking of revenue, collections, receivables, and subscription contracts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={refetchAll}
            disabled={isFetching}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Time range filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={timeRange}
              onChange={(e) => updateFilter('range', e.target.value)}
              className="text-xs text-slate-700 bg-transparent focus:outline-hidden font-medium"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="year">Past 12 Months</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="text-xs text-slate-700 bg-transparent focus:outline-hidden font-medium"
            >
              <option value="all">All Invoices</option>
              <option value="confirmed">Confirmed</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Invoiced Total</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <MoneyText amount={metrics.totalInvoiced} />
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Billed to customers</span>
        </div>

        {/* Collected Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Collected Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            <MoneyText amount={metrics.totalCollected} variant="positive" />
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Successfully settled</span>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Receivables</span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            <MoneyText amount={metrics.totalOutstanding} />
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Pending payment</span>
        </div>

        {/* Overdue Receivables */}
        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Balance</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">
            <MoneyText amount={metrics.totalOverdue} variant="negative" />
          </div>
          <span className="text-xs text-rose-600/70 mt-1 block">
            {metrics.overdueCount} overdue invoices
          </span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Revenue & Collections Trend</h3>
            <p className="text-xs text-slate-500">Comparison of invoiced total vs. actual payments collected</p>
          </div>

          <div className="h-64 w-full">
            {timelineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="invoiced" name="Invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No revenue data available for the selected period
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Invoices by Status</h3>
            <p className="text-xs text-slate-500">Distribution across invoice workflow stages</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {statusChartData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || '#cbd5e1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">No invoices in this view</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Payment Methods & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Payment Channels</h3>
            <p className="text-xs text-slate-500">Settled volume by payment method</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {methodChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="amount"
                    label={({ name }) => name}
                  >
                    {methodChartData.map((_, index) => (
                      <Cell key={index} fill={METHOD_COLORS[index % METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">No payment receipts logged yet</div>
            )}
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Invoices</h3>
              <p className="text-xs text-slate-500">Latest billing items requiring attention</p>
            </div>
            <span className="text-xs text-indigo-600 font-medium">
              {metrics.activeSubscriptionsCount} active subscriptions
            </span>
          </div>

          <div className="flex-1">
            <DataTable
              columns={recentColumns}
              data={recentInvoices}
              isLoading={invoicesLoading}
              error={invoicesError ? (invoicesError as Error).message : null}
              emptyTitle="No recent invoices"
              emptyDescription="Invoices generated by the billing engine will appear here."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
