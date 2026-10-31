import type { RouteObject } from 'react-router-dom';
import { FinanceDashboardPage } from './FinanceDashboardPage';
import { RequireAuth } from '../../auth/RequireAuth';
import { RequireRole } from '../../auth/RequireRole';

export const dashboardRoutes: RouteObject[] = [
  {
    path: '/dashboard',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff']}>
          <FinanceDashboardPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
];
