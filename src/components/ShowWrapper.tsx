import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { Permission } from '../types/permissions.types';

interface ShowWrapperProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode; // optional — kuch nahi diya to simply hide ho jaata hai
}

// Wraps any UI piece — button, card, section — and only renders it if the
// current user's role has that specific permission.
const ShowWrapper: React.FC<ShowWrapperProps> = ({ permission, children, fallback = null }) => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(permission) ? <>{children}</> : <>{fallback}</>;
};

export default ShowWrapper;