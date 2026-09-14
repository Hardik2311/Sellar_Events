import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { Permission } from '../types/permissions.types';
import PermissionDeniedPage from '../pages/PermissionDeniedPage';

interface PermissionRouteProps {
  permission: Permission;
  children: React.ReactNode;
}

const PermissionRoute: React.FC<PermissionRouteProps> = ({ permission, children }) => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(permission)) {
    return <PermissionDeniedPage />;
  }

  return <>{children}</>;
};

export default PermissionRoute;