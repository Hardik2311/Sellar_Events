export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Organizer (protected) parent + children — children are relative paths
  EVENTS: '/events',
  EVENTS_CREATE: 'create',
  EVENTS_ATTENDEES: 'attendees',
  EVENTS_ACCOUNT: 'account',
  EVENTS_ACCOUNT_EDIT: 'account/edit',
  EVENTS_ACCOUNT_ADDONS: 'account/addons',              // NEW – Add-ons list page
  EVENTS_WHATSAPP_INTEGRATION: 'account/addons/whatsapp', // NEW – WhatsApp integration status page
  EVENTS_DISCOVER: 'discover',
  EVENTS_DETAIL: 'e/:id',
  EVENTS_SETTINGS: 'settings',
  EVENTS_SETTINGS_EVENT: 'settings/event',
  EVENTS_SETTINGS_COMPANY: 'settings/company',
  EVENTS_SETTINGS_APP: 'settings/app',
  EVENTS_SETTINGS_USERS: 'settings/users',      // NEW – list/manage users
  EVENTS_USER_ADD: 'settings/users/add',        // NEW – add user form
  EVENTS_SUPPORT: 'support',
  EVENTS_REPORTS: 'reports',
  EVENTS_REPORTS_EXPENSE: 'reports/expense/:eventId',
  EVENTS_REPORTS_SALES: 'reports/sales/:eventId',
  EVENTS_REPORTS_CUSTOMER: 'reports/customer/:eventId',
  EVENTS_REPORTS_PNL: 'reports/pnl/:eventId',
  EVENTS_SETTINGS_PERMISSIONS: 'settings/permissions',

  // Public, customer-facing routes
  // :slug is "event-title--<firestoreId>" — id is parsed out after the last "--"
  DISCOVER: '/discover',
  EVENT_DETAIL: '/e/:slug',
  CHECKOUT: '/checkout/:id',
};