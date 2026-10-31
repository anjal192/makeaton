import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
          <LockKeyhole className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Reset Password</h1>
        <p className="text-sm text-slate-500 mb-6">
          This screen is reserved for Member A (Auth Module).
        </p>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 text-left mb-6 space-y-1">
          <p className="font-semibold text-slate-800">Endpoint spec:</p>
          <code className="text-indigo-600 font-mono block">POST /auth/reset-password</code>
          <p>Token detected: <code className="text-slate-800 break-all">{token || '(none in URL)'}</code></p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full py-2 px-4 bg-slate-800 text-white font-medium rounded-lg text-sm hover:bg-slate-700 transition"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
};
