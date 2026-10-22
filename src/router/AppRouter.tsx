import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import SuperAdminRoute from '../components/SuperAdminRoute';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorScreen from '../components/ErrorScreen';
import RouteError from '../components/RouteError';
import { ROUTES } from '../constants/routes.constants';
import { AppRegistry } from './AppRegistry';
import { getSubdomain } from '../lib/subdomain';

// Lazy so customers on a storefront never download the organizer shell
// (sidebar, expense/income/user modals, dashboard data fetching).
const EventsLayout = lazy(() => import('../Layout/EventsLayout'));
const Login = lazy(() => import('../pages/LoginPage'));
const Signup = lazy(() => import('../pages/SignUp'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const CustomerEventDiscover = lazy(() => import('../pages/Customereventdiscover'));
const CustomerEventDetail = lazy(() => import('../pages/Customereventdetail'));
const CheckoutPage = lazy(() => import('../pages/Checkout'));
const StorefrontPolicy = lazy(() => import('../pages/StorefrontPolicy'));

// Super Admin — standalone, no Events sidebar/layout
const SuperAdminHub = lazy(() => import('../pages/SuperAdmin/SuperAdminHub'));
const SuperAdminSupportTickets = lazy(() => import('../pages/SuperAdmin/SupportAdminSupportTickets'));
const SuperAdminPlanLeads = lazy(() => import('../pages/SuperAdmin/SuperAdminPlanLeads'));
const SuperAdminCompanies = lazy(() => import('../pages/SuperAdmin/SuperAdminCompanies'));
const SuperAdminOutsoldEvents = lazy(() => import('../pages/SuperAdmin/SuperAdminOutsoldEvents'));
const SuperAdminPayments = lazy(() => import('../pages/SuperAdmin/SuperAdminPayments'));
const SuperAdminPayouts = lazy(() => import('../pages/SuperAdmin/SuperAdminPayouts'));
const SuperAdminSendTickets = lazy(() => import('../pages/SuperAdmin/SuperAdminSendTickets'));

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

// Suspense fallback while a lazy page chunk loads — on a customer subdomain it
// wears the brand theme so the store doesn't flash a bare grey screen.
const Loading = () => (
  <div
    className={`flex h-dvh w-full items-center justify-center ${subdomain ? 'brand-theme bg-[var(--brand-cream)]' : ''}`}
  >
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#007A78] border-t-transparent" />
  </div>
);

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
        errorElement: <RouteError />,
        children: [
          { index: true, element: <CustomerEventDiscover /> },
          { path: 'e/:slug', element: <CustomerEventDetail /> },
          { path: 'checkout/:id', element: <CheckoutPage /> },
          { path: 'policies/:policy', element: <StorefrontPolicy /> },
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
        errorElement: <RouteError />,
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

          // Super Admin — protected (auth required + super-admin UID check)
          // but NOT wrapped in EventsLayout/sidebar
          {
            path: ROUTES.EVENTS_SUPER_ADMIN,
            element: (
              <ProtectedRoute>
                <SuperAdminRoute>
                  <Outlet />
                </SuperAdminRoute>
              </ProtectedRoute>
            ),
            children: [
              { index: true, element: <SuperAdminHub /> },
              { path: 'support-tickets', element: <SuperAdminSupportTickets /> },
              { path: 'plan-leads', element: <SuperAdminPlanLeads /> },
              { path: 'companies', element: <SuperAdminCompanies /> },
              { path: 'outsold-events', element: <SuperAdminOutsoldEvents /> },
              { path: 'payments', element: <SuperAdminPayments /> },
              { path: 'payouts', element: <SuperAdminPayouts /> },
              { path: 'send-tickets', element: <SuperAdminSendTickets /> },
            ],
          },

          // Public customer-facing routes (for fallback/development/testing without subdomain)
          { path: ROUTES.DISCOVER, element: <CustomerEventDiscover /> },
          { path: ROUTES.EVENT_DETAIL, element: <CustomerEventDetail /> },
          { path: ROUTES.CHECKOUT, element: <CheckoutPage /> },
          { path: ROUTES.POLICY, element: <StorefrontPolicy /> },

          // Company-scoped fallback for merchants without a claimed subdomain
          { path: ROUTES.PUBLIC_STORE, element: <CustomerEventDiscover /> },
          { path: ROUTES.PUBLIC_EVENT_DETAIL, element: <CustomerEventDetail /> },
          { path: ROUTES.PUBLIC_CHECKOUT, element: <CheckoutPage /> },
          { path: ROUTES.PUBLIC_POLICY, element: <StorefrontPolicy /> },

          // Unmatched URL
          { path: '*', element: <ErrorScreen kind="not-found" /> },
        ],
      },
    ]);

const AppRouter = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRouter;