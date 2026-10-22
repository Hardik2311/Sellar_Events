// Platform super admins. Keep in sync with isSuperAdmin() in firestore.rules
// and SUPER_ADMIN_UIDS in functions/payments/platformConfig.js.
export const SUPER_ADMIN_UIDS: string[] = ['sR4lj7OfkAc7DhdxfHhuC7XAzLC2', '8ZanoQBNWbeKTfOIVrddKObJuP02'];

export const isSuperAdminUid = (uid?: string | null): boolean => !!uid && SUPER_ADMIN_UIDS.includes(uid);
