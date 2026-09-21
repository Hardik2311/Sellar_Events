import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../lib/firebase';

interface AddTeamMemberPayload {
  companyId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  role: string;
}

export const addTeamMember = async (payload: AddTeamMemberPayload) => {
  const functions = await getFunctionsInstance();
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
  const functions = await getFunctionsInstance();
  const deleteTeamMemberFn = httpsCallable(functions, 'deleteTeamMember');
  const result = await deleteTeamMemberFn(payload);
  return result.data as { success: boolean; message: string };
};

// NEW — Super Admin only; deletes a company's Auth users and its entire Firestore doc tree
export const deleteCompanyData = async (payload: { companyId: string }) => {
  const functions = await getFunctionsInstance();
  const deleteCompanyDataFn = httpsCallable(functions, 'deleteCompanyData');
  const result = await deleteCompanyDataFn(payload);
  return result.data as { success: boolean; message: string };
};
