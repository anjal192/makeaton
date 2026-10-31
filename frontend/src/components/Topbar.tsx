import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { Menu, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu }) => {
  const { user, role, logout } = useAuth();

  const roleBadgeColor = {
    admin: 'bg-purple-50 text-purple-700 border-purple-200',
    staff: 'bg-blue-50 text-blue-700 border-blue-200',
    customer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[role || 'customer'];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
          <span>Brightloop Console</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role badge */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadgeColor}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="capitalize">{role || 'User'}</span>
        </div>

        {/* User email / details */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-700">
          <UserIcon className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{user?.full_name || user?.email}</span>
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
          title="Sign out of account"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
