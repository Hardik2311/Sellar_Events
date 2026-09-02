// Flat, named permissions — one flag per real action/feature.
// erasableSyntaxOnly-safe (as const object, not a real enum).
export const Permission = {
  // Dashboard
  VIEW_DASHBOARD: 'viewDashboard',
  TOGGLE_SENSITIVE_DATA: 'toggleSensitiveData',

  // Create Event
  VIEW_CREATE_EVENT: 'viewCreateEvent',
  PUBLISH_EVENT: 'publishEvent',
  SAVE_DRAFT_EVENT: 'saveDraftEvent',

  // My Events (organizer's event list — "Discover" in sidebar)
  VIEW_MY_EVENTS: 'viewMyEvents',
  EDIT_EVENT: 'editEvent',
  DELETE_EVENT: 'deleteEvent',
  DUPLICATE_EVENT: 'duplicateEvent',
  TOGGLE_EVENT_LIVE: 'toggleEventLive',
  TOGGLE_EVENT_FEATURED: 'toggleEventFeatured',

  // Attendees
  VIEW_ATTENDEES: 'viewAttendees',
  CHECK_IN_ATTENDEE: 'checkInAttendee',
  CANCEL_ATTENDEE: 'cancelAttendee',
  EXPORT_ATTENDEES: 'exportAttendees',
  EDIT_ATTENDEE: 'editAttendee',
  SCAN_QR: 'scanQr',
   IMPORT_ATTENDEES: 'import_attendees',
  ADD_WALK_IN_ATTENDEE: 'addWalkInAttendee', // NEW — manually add an attendee (on-the-spot / after sale closes)

  // Reports
  VIEW_REPORTS: 'viewReports',
  VIEW_EXPENSE_REPORT: 'viewExpenseReport',
  VIEW_SALES_REPORT: 'viewSalesReport',
  VIEW_CUSTOMER_REPORT: 'viewCustomerReport',
  VIEW_PNL_REPORT: 'viewPnlReport',

  // Settings
  VIEW_SETTINGS: 'viewSettings',
  EDIT_EVENT_SETTINGS: 'editEventSettings',
  EDIT_COMPANY_SETTINGS: 'editCompanySettings',
  EDIT_APP_SETTINGS: 'editAppSettings',

  // Expense
  ADD_EXPENSE: 'addExpense',
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

interface PermissionGroup {
  title: string;
  items: { key: Permission; label: string }[];
}

// Drives the Settings UI — grouped exactly like the screenshot's sections.
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Dashboard & General',
    items: [
      { key: Permission.VIEW_DASHBOARD, label: 'View Dashboard' },
      { key: Permission.TOGGLE_SENSITIVE_DATA, label: 'Show/Hide Sensitive Data' },
    ],
  },
  {
    title: 'Create Event',
    items: [
      { key: Permission.VIEW_CREATE_EVENT, label: 'Access Create Event' },
      { key: Permission.PUBLISH_EVENT, label: 'Publish Event' },
      { key: Permission.SAVE_DRAFT_EVENT, label: 'Save as Draft' },
    ],
  },
  {
    title: 'My Events',
    items: [
      { key: Permission.VIEW_MY_EVENTS, label: 'View My Events' },
      { key: Permission.EDIT_EVENT, label: 'Edit Event' },
      { key: Permission.DELETE_EVENT, label: 'Delete Event' },
      { key: Permission.DUPLICATE_EVENT, label: 'Duplicate Event' },
      { key: Permission.TOGGLE_EVENT_LIVE, label: 'Toggle Live/Draft' },
      { key: Permission.TOGGLE_EVENT_FEATURED, label: 'Toggle Featured' },
    ],
  },
  {
    title: 'Attendees',
    items: [
      { key: Permission.VIEW_ATTENDEES, label: 'View Attendees' },
      { key: Permission.CHECK_IN_ATTENDEE, label: 'Check-in Attendee' },
      { key: Permission.CANCEL_ATTENDEE, label: 'Cancel Ticket' },
      { key: Permission.EXPORT_ATTENDEES, label: 'Export Attendee List' },
      { key: Permission.SCAN_QR, label: 'Scan QR Code' },
      { key: Permission.ADD_WALK_IN_ATTENDEE, label: 'Add Walk-in Attendee' },
      { key: Permission.IMPORT_ATTENDEES, label: 'Import Attendees (Excel/CSV)' },
      { key: Permission.EDIT_ATTENDEE, label: 'Edit Attendee Details' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { key: Permission.VIEW_REPORTS, label: 'Access Reports' },
      { key: Permission.VIEW_EXPENSE_REPORT, label: 'View Expense Report' },
      { key: Permission.VIEW_SALES_REPORT, label: 'View Sales Report' },
      { key: Permission.VIEW_CUSTOMER_REPORT, label: 'View Customer Report' },
      { key: Permission.VIEW_PNL_REPORT, label: 'View P&L Report' },

    ],
  },
  {
    title: 'Settings',
    items: [
      { key: Permission.VIEW_SETTINGS, label: 'Access Settings' },
      { key: Permission.EDIT_EVENT_SETTINGS, label: 'Edit Event Settings' },
      { key: Permission.EDIT_COMPANY_SETTINGS, label: 'Edit Company Settings' },
      { key: Permission.EDIT_APP_SETTINGS, label: 'Edit App Settings' },
    ],
  },
  {
    title: 'Expenses',
    items: [{ key: Permission.ADD_EXPENSE, label: 'Add Expense' }],
  },
];

export type RolePermissions = Record<Permission, boolean>;

export interface PermissionsByRole {
  team_leader: RolePermissions;
  team: RolePermissions;
}

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const buildRole = (enabled: Permission[]): RolePermissions => {
  const perms = {} as RolePermissions;
  ALL_PERMISSION_KEYS.forEach((key) => {
    perms[key] = enabled.includes(key);
  });
  return perms;
};

// Starting point only — owner changes these anytime from Settings → Permissions.
export const DEFAULT_PERMISSIONS: PermissionsByRole = {
  team_leader: buildRole([
    Permission.VIEW_DASHBOARD,
    Permission.TOGGLE_SENSITIVE_DATA,
    Permission.VIEW_CREATE_EVENT,
    Permission.PUBLISH_EVENT,
    Permission.SAVE_DRAFT_EVENT,
    Permission.VIEW_MY_EVENTS,
    Permission.EDIT_EVENT,
    Permission.DUPLICATE_EVENT,
    Permission.TOGGLE_EVENT_LIVE,
    Permission.TOGGLE_EVENT_FEATURED,
    Permission.VIEW_ATTENDEES,
    Permission.CHECK_IN_ATTENDEE,
    Permission.CANCEL_ATTENDEE,
    Permission.EXPORT_ATTENDEES,
    Permission.SCAN_QR,
    Permission.ADD_WALK_IN_ATTENDEE,
    Permission.IMPORT_ATTENDEES,
    Permission.EDIT_ATTENDEE,
    Permission.VIEW_REPORTS,
    Permission.ADD_EXPENSE,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_EVENT_SETTINGS,
    Permission.EDIT_COMPANY_SETTINGS,
    Permission.EDIT_APP_SETTINGS,
  ]),
  team: buildRole([
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ATTENDEES,
    Permission.CHECK_IN_ATTENDEE,
    Permission.SCAN_QR,
    Permission.ADD_WALK_IN_ATTENDEE,
    Permission.VIEW_SETTINGS,
    Permission.EDIT_APP_SETTINGS,
  ]),
};

export const DEFAULT_PERMISSIONS_FLAT = buildRole([]); // all-false shape, used by Reset to Default