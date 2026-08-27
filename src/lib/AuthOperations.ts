import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface AddTeamMemberPayload {
  companyId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  role: string;
}

export const addTeamMember = async (payload: AddTeamMemberPayload) => {
  const addTeamMemberFn = httpsCallable(functions, 'addTeamMember');
  const result = await addTeamMemberFn(payload);
  return result.data as { success: boolean; uid: string };
};

// NEW
interface DeleteTeamMemberPayload {
  companyId: string;
  targetUid: string;
}

export const deleteTeamMember = async (payload: DeleteTeamMemberPayload) => {
  const deleteTeamMemberFn = httpsCallable(functions, 'deleteTeamMember');
  const result = await deleteTeamMemberFn(payload);
  return result.data as { success: boolean; message: string };
};