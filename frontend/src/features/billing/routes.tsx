import type { RouteObject } from 'react-router-dom';
import { BillingPlaceholderPage } from './BillingPlaceholderPage';
import { RequireAuth } from '../../auth/RequireAuth';
import { RequireRole } from '../../auth/RequireRole';

export const billingRoutes: RouteObject[] = [
  {
    path: '/billing/subscriptions',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff', 'customer']}>
          <BillingPlaceholderPage
            title="Subscriptions & Contracts"
            section="subscriptions"
            endpoints={[
              'GET /subscriptions',
              'POST /subscriptions',
              'GET /subscriptions/{id}',
              'PUT /subscriptions/{id}/status',
              'GET /subscriptions/{id}/invoices',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/billing/invoices',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff', 'customer']}>
          <BillingPlaceholderPage
            title="Invoices & Statements"
            section="invoices"
            endpoints={[
              'GET /invoices',
              'GET /invoices/{id}',
              'POST /invoices/{id}/confirm',
              'POST /invoices/{id}/cancel',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/billing/templates',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff']}>
          <BillingPlaceholderPage
            title="Quotation Templates"
            section="templates"
            endpoints={[
              'GET /quotation-templates',
              'POST /quotation-templates',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
];
