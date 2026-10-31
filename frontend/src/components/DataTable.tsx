import React from 'react';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { AlertCircle } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  cell?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  rowKey?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display right now.',
  emptyAction,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  if (error) {
    return (
      <div className="p-8 my-4 bg-white rounded-xl border border-rose-200 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">Failed to load data</h3>
        <p className="text-sm text-slate-600 max-w-sm mx-auto mb-4">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (isLoading && data.length === 0) {
    return (
      <div className="p-16 my-4 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center">
        <Spinner size="lg" label="Loading data..." />
      </div>
    );
  }

  if (!isLoading && data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="relative overflow-hidden bg-white rounded-xl border border-slate-200 shadow-2xs">
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs z-10 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-xs tracking-wider">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3 font-semibold ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, rowIdx) => {
              const key = rowKey ? rowKey(row) : (row as any).id ?? rowIdx;
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, colIdx) => {
                    let content: React.ReactNode = null;
                    if (col.cell) {
                      content = col.cell(row);
                    } else if (typeof col.accessor === 'function') {
                      content = col.accessor(row);
                    } else if (col.accessor) {
                      content = (row as any)[col.accessor];
                    }
                    return (
                      <td
                        key={colIdx}
                        className={`px-4 py-3 text-slate-700 ${col.className || ''}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
