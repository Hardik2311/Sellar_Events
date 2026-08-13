export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',

  // Organizer (protected) parent + children — children are relative paths
  EVENTS: '/events',
  EVENTS_CREATE: 'create',
  EVENTS_ATTENDEES: 'attendees',
  EVENTS_ACCOUNT: 'account',
  EVENTS_ACCOUNT_EDIT: 'account/edit',
  EVENTS_DISCOVER: 'discover',
  EVENTS_DETAIL: 'e/:id',
  EVENTS_SETTINGS: 'settings',
  EVENTS_SETTINGS_EVENT: 'settings/event',
  EVENTS_SETTINGS_COMPANY: 'settings/company',
  EVENTS_SETTINGS_APP: 'settings/app',
   EVENTS_SUPPORT: 'support',

  // Public, customer-facing routes
  // :slug is "event-title--<firestoreId>" — id is parsed out after the last "--"
  DISCOVER: '/discover',
  EVENT_DETAIL: '/e/:slug',
  CHECKOUT: '/checkout/:id',
};