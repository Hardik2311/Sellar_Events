import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import EventsLayout from '../Layout/EventsLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import { ROUTES } from '../constants/routes.constants';
import { AppRegistry } from './AppRegistry';
import { getSubdomain } from '../lib/subdomain';

const Login = lazy(() => import('../pages/LoginPage'));
const Signup = lazy(() => import('../pages/SignUp'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const CustomerEventDiscover = lazy(() => import('../pages/Customereventdiscover'));
const CustomerEventDetail = lazy(() => import('../pages/Customereventdetail'));
const CheckoutPage = lazy(() => import('../pages/Checkout'));

// Super Admin — standalone, no Events sidebar/layout
const SuperAdminHub = lazy(() => import('../pages/SuperAdmin/SuperAdminHub'));
const SuperAdminSupportTickets = lazy(() => import('../pages/SuperAdmin/SupportAdminSupportTickets'));
const SuperAdminPlanLeads = lazy(() => import('../pages/SuperAdmin/SuperAdminPlanLeads'));

const Loading = () => <div>Loading...</div>;

const generateDynamicRoutes = (layoutType: 'EVENTS') => {
  return AppRegistry.filter((app) => app.layout === layoutType).flatMap((app) =>
    app.routes.map((route) => ({
      index: route.isIndex,
      path: route.isIndex ? undefined : route.path,
      element: <route.component />,
    }))
  );
};

const subdomain = getSubdomain();

const router = subdomain
  ? createBrowserRouter([
      {
        path: '/',
        element: (
          <>
            <ScrollRestoration />
            <Outlet />
          </>
        ),
        children: [
          { index: true, element: <CustomerEventDiscover /> },
          { path: 'e/:slug', element: <CustomerEventDetail /> },
          { path: 'checkout/:id', element: <CheckoutPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ])
  : createBrowserRouter([
      {
        path: '/',
        element: (
          <>
            <ScrollRestoration />
            <Outlet />
          </>
        ),
        children: [
          { index: true, element: <Navigate to={ROUTES.EVENTS} replace /> },

          { path: ROUTES.LOGIN, element: <Login /> },
          { path: ROUTES.SIGNUP, element: <Signup /> },
          { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
          { path: ROUTES.RESET_PASSWORD, element: <ResetPassword /> },

          // Protected organizer app
          {
            path: ROUTES.EVENTS,
            element: (
              <ProtectedRoute>
                <EventsLayout />
              </ProtectedRoute>
            ),
            children: generateDynamicRoutes('EVENTS'),
          },

          // Super Admin — protected (auth required) but NOT wrapped in EventsLayout/sidebar
          {
            path: ROUTES.EVENTS_SUPER_ADMIN,
            element: (
              <ProtectedRoute>
                <Outlet />
              </ProtectedRoute>
            ),
            children: [
              { index: true, element: <SuperAdminHub /> },
              { path: 'support-tickets', element: <SuperAdminSupportTickets /> },
              { path: 'plan-leads', element: <SuperAdminPlanLeads /> },
            ],
          },

          // Public customer-facing routes (for fallback/development/testing without subdomain)
          { path: ROUTES.DISCOVER, element: <CustomerEventDiscover /> },
          { path: ROUTES.EVENT_DETAIL, element: <CustomerEventDetail /> },
          { path: ROUTES.CHECKOUT, element: <CheckoutPage /> },

          // Company-scoped fallback for merchants without a claimed subdomain
          { path: ROUTES.PUBLIC_STORE, element: <CustomerEventDiscover /> },
          { path: ROUTES.PUBLIC_EVENT_DETAIL, element: <CustomerEventDetail /> },
          { path: ROUTES.PUBLIC_CHECKOUT, element: <CheckoutPage /> },
        ],
      },
    ]);

const AppRouter = () => {
  return (
    <Suspense fallback={<Loading />}>
      <RouterProvider router={router} />
    </Suspense>
  );
};

export default AppRouter;