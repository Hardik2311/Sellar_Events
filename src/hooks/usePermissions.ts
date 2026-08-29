import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../enum/enum';
import {
  DEFAULT_PERMISSIONS,
  type PermissionsByRole,
  type Permission,
} from '../types/permissions.types';

export const usePermissions = () => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsByRole>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, 'companies', profile.companyId, 'settings', 'permissions');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<PermissionsByRole>;
          setPermissions({
            team_leader: { ...DEFAULT_PERMISSIONS.team_leader, ...data.team_leader },
            team: { ...DEFAULT_PERMISSIONS.team, ...data.team },
          });
        } else {
          setPermissions(DEFAULT_PERMISSIONS);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, [profile?.companyId]);

    // Owner (admin) bypasses the table entirely — always full access.
  const can = useCallback(
    (permission: Permission): boolean => {
      if (profile?.role === ROLES.ORGANIZER) return true;
      if (profile?.role === ROLES.TEAM_LEADER) return permissions.team_leader[permission] ?? false;
      if (profile?.role === ROLES.TEAM) return permissions.team[permission] ?? false;
      return false;
    },
    [profile?.role, permissions]
  );

  return { permissions, can, loading, isOwner: profile?.role === ROLES.ORGANIZER };
};