import type { RouteObject } from 'react-router-dom';
import { CatalogPlaceholderPage } from './CatalogPlaceholderPage';
import { RequireAuth } from '../../auth/RequireAuth';
import { RequireRole } from '../../auth/RequireRole';

export const catalogRoutes: RouteObject[] = [
  {
    path: '/catalog/products',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff']}>
          <CatalogPlaceholderPage
            title="Products & Variants"
            section="products"
            endpoints={[
              'GET /catalog/products',
              'POST /catalog/products',
              'GET /catalog/products/{id}',
              'POST /catalog/products/{id}/variants',
              'DELETE /catalog/products/{id}',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/catalog/plans',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin', 'staff']}>
          <CatalogPlaceholderPage
            title="Subscription Plans"
            section="plans"
            endpoints={[
              'GET /catalog/plans',
              'POST /catalog/plans',
              'GET /catalog/plans/{id}',
              'PUT /catalog/plans/{id}',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/catalog/taxes',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin']}>
          <CatalogPlaceholderPage
            title="Tax Rates"
            section="taxes"
            endpoints={[
              'GET /catalog/taxes',
              'POST /catalog/taxes',
              'PUT /catalog/taxes/{id}',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/catalog/discounts',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin']}>
          <CatalogPlaceholderPage
            title="Discounts & Coupons"
            section="discounts"
            endpoints={[
              'GET /catalog/discounts',
              'POST /catalog/discounts',
              'PUT /catalog/discounts/{id}',
            ]}
          />
        </RequireRole>
      </RequireAuth>
    ),
  },
];
