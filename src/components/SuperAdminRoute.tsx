import React from 'react';
import { useSuperAdmin } from '../hooks/usePlatformPayments';
import PermissionDeniedPage from '../pages/PermissionDeniedPage';

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

// Gates the WHOLE /events/super-admin subtree (hub included) in one place.
// Individual Super Admin pages used to each do their own isSuperAdmin check,
// but the hub/menu page itself never did — so any logged-in user could open
// it and see every Super Admin tool listed, even though clicking into most
// of them then showed Access Denied. Centralizing it here means a new
// Super Admin page can't accidentally ship without this check again.
const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({ children }) => {
  const { checked, isSuperAdmin } = useSuperAdmin();
  if (!checked) return null;
  if (!isSuperAdmin) return <PermissionDeniedPage />;

  return <>{children}</>;
};

export default SuperAdminRoute;
