import { lazy } from 'react';
import { ROUTES } from '../constants/routes.constants';

const EventDashboard = lazy(() => import('../pages/EventDashboard'));
const CreateEvent = lazy(() => import('../pages/CreateEvent'));
const Attendees = lazy(() => import('../pages/Attendees'));
const Account = lazy(() => import('../pages/Account'));
const EditProfile = lazy(() => import('../pages/EditProfile'));
const OrganizerEventDiscover = lazy(() => import('../pages/Organizereventdiscover'));
const OrganizerEventDetail = lazy(() => import('../pages/Organizereventdetail'));
const SettingsHub = lazy(() => import('../pages/SettingHub'));
const EventFieldSettings = lazy(() => import('../pages/EventSettings'));
const CompanySettings = lazy(() => import('../pages/CompanySetting'));
const AppSettings = lazy(() => import('../pages/AppSettings'));
const SupportPage = lazy(() => import('../pages/SupportPage'));

export interface AppRoute {
  path?: string;
  component: React.ElementType;
  isIndex?: boolean;
}

export interface AppModule {
  id: string;
  name: string;
  layout: 'EVENTS';
  routes: AppRoute[];
}

export const AppRegistry: AppModule[] = [
  {
    id: 'organizer',
    name: 'Organizer Dashboard',
    layout: 'EVENTS',
    routes: [
      { component: EventDashboard, isIndex: true },
      { path: ROUTES.EVENTS_CREATE, component: CreateEvent },
      { path: ROUTES.EVENTS_ATTENDEES, component: Attendees },
      { path: ROUTES.EVENTS_ACCOUNT, component: Account },
      { path: ROUTES.EVENTS_ACCOUNT_EDIT, component: EditProfile },
      { path: ROUTES.EVENTS_DISCOVER, component: OrganizerEventDiscover },
      { path: ROUTES.EVENTS_DETAIL, component: OrganizerEventDetail },
      { path: ROUTES.EVENTS_SETTINGS, component: SettingsHub },
      { path: ROUTES.EVENTS_SETTINGS_EVENT, component: EventFieldSettings },
      { path: ROUTES.EVENTS_SETTINGS_COMPANY, component: CompanySettings },
      { path: ROUTES.EVENTS_SETTINGS_APP, component: AppSettings },
      { path: ROUTES.EVENTS_SUPPORT, component: SupportPage },
    ],
  },
  // Adding a new module later (e.g. "billing") just means pushing another
  // AppModule object here — AppRouter picks it up automatically.
];