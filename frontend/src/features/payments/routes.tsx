import type { RouteObject } from 'react-router-dom';
import { PaymentsListPage } from './PaymentsListPage';
import { OverdueInvoicesPage } from './OverdueInvoicesPage';
import { RequireAuth } from '../../auth/RequireAuth';
import { RequireRole } from '../../auth/RequireRole';

export const paymentsRoutes: RouteObject[] = [
  {
    path: '/payments',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff']}>
          <PaymentsListPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/payments/overdue',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff']}>
          <OverdueInvoicesPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
];
