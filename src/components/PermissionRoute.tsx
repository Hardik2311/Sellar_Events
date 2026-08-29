import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { Permission } from '../types/permissions.types';

interface PermissionRouteProps {
  permission: Permission;
  children: React.ReactNode;
}

const PermissionRoute: React.FC<PermissionRouteProps> = ({ permission, children }) => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(permission)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionRoute;