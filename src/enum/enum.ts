export const ROLES = {
  ORGANIZER: 'admin',        // matches existing Firestore role value for the owner
  TEAM_LEADER: 'team_leader',
  TEAM: 'team',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const CREATABLE_ROLES: Record<string, Role[]> = {
  [ROLES.ORGANIZER]: [ROLES.TEAM_LEADER, ROLES.TEAM],
  [ROLES.TEAM_LEADER]: [ROLES.TEAM],
};

export const canManageUsers = (role?: string): boolean =>
  role === ROLES.ORGANIZER || role === ROLES.TEAM_LEADER;