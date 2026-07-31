import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import EventsLayout from '../Layout/EventsLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import { ROUTES } from '../constants/routes.constants';
import { AppRegistry } from './AppRegistry';

const Login = lazy(() => import('../pages/LoginPage'));
const Signup = lazy(() => import('../pages/SignUp'));
const CustomerEventDiscover = lazy(() => import('../pages/Customereventdiscover'));
const CustomerEventDetail = lazy(() => import('../pages/Customereventdetail'));
const CheckoutPage = lazy(() => import('../pages/Checkout'));

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

const router = createBrowserRouter([
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

      // Public customer-facing routes
      { path: ROUTES.DISCOVER, element: <CustomerEventDiscover /> },
      { path: ROUTES.EVENT_DETAIL, element: <CustomerEventDetail /> },
      { path: ROUTES.CHECKOUT, element: <CheckoutPage /> },
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