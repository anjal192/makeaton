import type { RouteObject } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { StaffPage } from './StaffPage';
import { RequireAuth } from '../../auth/RequireAuth';
import { RequireRole } from '../../auth/RequireRole';

export const authPublicRoutes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
];

export const authProtectedRoutes: RouteObject[] = [
  {
    path: '/auth/staff',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin']}>
          <StaffPage />
        </RequireRole>
      </RequireAuth>
    ),
  },
];
