import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  LayoutDashboard,
  CreditCard,
  AlertOctagon,
  Package,
  Layers,
  CalendarDays,
  Percent,
  Receipt,
  FileSpreadsheet,
  Users,
  Repeat,
  X,
} from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { role, user } = useAuth();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    );

  const sectionHeaderClass = 'text-xs font-semibold text-slate-400 uppercase tracking-wider px-3.5 mt-6 mb-2';

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            B
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-tight">Brightloop</div>
            <div className="text-[11px] text-slate-400 font-medium">Subscription Platform</div>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Main section for Admin and Staff */}
        {(role === 'admin' || role === 'staff') && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
              Overview
            </div>
            <NavLink to="/dashboard" className={navItemClass} onClick={onCloseMobile}>
              <LayoutDashboard className="w-4 h-4" />
              Finance Dashboard
            </NavLink>

            <div className={sectionHeaderClass}>Payments & Receivables</div>
            <NavLink to="/payments" end className={navItemClass} onClick={onCloseMobile}>
              <CreditCard className="w-4 h-4" />
              Payments
            </NavLink>
            <NavLink to="/payments/overdue" className={navItemClass} onClick={onCloseMobile}>
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              Overdue Invoices
            </NavLink>

            <div className={sectionHeaderClass}>Billing & Subscriptions</div>
            <NavLink to="/billing/subscriptions" className={navItemClass} onClick={onCloseMobile}>
              <Repeat className="w-4 h-4" />
              Subscriptions
            </NavLink>
            <NavLink to="/billing/invoices" className={navItemClass} onClick={onCloseMobile}>
              <Receipt className="w-4 h-4" />
              Invoices
            </NavLink>
            <NavLink to="/billing/templates" className={navItemClass} onClick={onCloseMobile}>
              <FileSpreadsheet className="w-4 h-4" />
              Quotation Templates
            </NavLink>

            <div className={sectionHeaderClass}>Catalog</div>
            <NavLink to="/catalog/products" className={navItemClass} onClick={onCloseMobile}>
              <Package className="w-4 h-4" />
              Products & Variants
            </NavLink>
            <NavLink to="/catalog/plans" className={navItemClass} onClick={onCloseMobile}>
              <CalendarDays className="w-4 h-4" />
              Subscription Plans
            </NavLink>

            {/* Admin-only features */}
            {role === 'admin' && (
              <>
                <NavLink to="/catalog/taxes" className={navItemClass} onClick={onCloseMobile}>
                  <Percent className="w-4 h-4" />
                  Tax Rates
                </NavLink>
                <NavLink to="/catalog/discounts" className={navItemClass} onClick={onCloseMobile}>
                  <Layers className="w-4 h-4" />
                  Discounts
                </NavLink>

                <div className={sectionHeaderClass}>Administration</div>
                <NavLink to="/auth/staff" className={navItemClass} onClick={onCloseMobile}>
                  <Users className="w-4 h-4" />
                  Staff Members
                </NavLink>
              </>
            )}
          </>
        )}

        {/* Customer view */}
        {role === 'customer' && (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
              My Account
            </div>
            <NavLink to="/billing/subscriptions" className={navItemClass} onClick={onCloseMobile}>
              <Repeat className="w-4 h-4" />
              My Subscriptions
            </NavLink>
            <NavLink to="/billing/invoices" className={navItemClass} onClick={onCloseMobile}>
              <Receipt className="w-4 h-4" />
              My Invoices
            </NavLink>
          </>
        )}
      </div>

      {/* User profile footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-sm shrink-0 uppercase">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {user?.full_name || 'User'}
            </div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
