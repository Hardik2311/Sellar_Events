import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_PERMISSIONS, type PermissionsByRole } from '../types/permissions.types';

const permissionsDocRef = (companyId: string) =>
  doc(db, 'companies', companyId, 'settings', 'permissions');

export const fetchPermissions = async (companyId: string): Promise<PermissionsByRole> => {
  const snap = await getDoc(permissionsDocRef(companyId));
  if (!snap.exists()) return DEFAULT_PERMISSIONS;
  const data = snap.data() as Partial<PermissionsByRole>;
  return {
    team_leader: { ...DEFAULT_PERMISSIONS.team_leader, ...data.team_leader },
    team: { ...DEFAULT_PERMISSIONS.team, ...data.team },
  };
};

export const savePermissions = async (companyId: string, permissions: PermissionsByRole) => {
  await setDoc(permissionsDocRef(companyId), permissions, { merge: true });
};