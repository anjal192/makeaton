import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type Role } from './AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RequireRoleProps {
  roles: Role[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { role, user } = useAuth();

  if (!role || !roles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto mt-16 text-center bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied (403)</h2>
        <p className="text-slate-600 text-sm mb-6">
          Your account ({user?.email}) has the role <span className="font-semibold capitalize text-slate-800">{role || 'user'}</span>, which does not have permission to view this page.
        </p>
        <div className="flex gap-3">
          <Link
            to={role === 'customer' ? '/billing/subscriptions' : '/dashboard'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to {role === 'customer' ? 'My Subscriptions' : 'Dashboard'}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
