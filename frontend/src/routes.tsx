import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthContext';
import { authPublicRoutes, authProtectedRoutes } from './features/auth/routes';
import { catalogRoutes } from './features/catalog/routes';
import { billingRoutes } from './features/billing/routes';
import { paymentsRoutes } from './features/payments/routes';
import { dashboardRoutes } from './features/dashboard/routes';

const HomeRedirect = () => {
  const { role, isLoading } = useAuth();
  if (isLoading) return null;
  if (role === 'customer') {
    return <Navigate to="/billing/subscriptions" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 font-bold text-2xl flex items-center justify-center mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <a
        href="/"
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
      >
        Return to Home
      </a>
    </div>
  );
};

export const router = createBrowserRouter([
  // Public Auth Routes
  ...authPublicRoutes,

  // Protected Routes within App Shell Layout
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      ...dashboardRoutes,
      ...paymentsRoutes,
      ...billingRoutes,
      ...catalogRoutes,
      ...authProtectedRoutes,
    ],
  },

  // 404 Catch-all
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
