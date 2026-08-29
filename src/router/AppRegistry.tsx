import { lazy } from 'react';
import { ROUTES } from '../constants/routes.constants';
import PermissionRoute from '../components/PermissionRoute';
import { Permission } from '../types/permissions.types';

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
const ManageUsersPage = lazy(() => import('../pages/Reports/ManageUsersPage'));
const UserAdd = lazy(() => import('../pages/UserAdd'));
const SupportPage = lazy(() => import('../pages/SupportPage'));
const AddOns = lazy(() => import('../pages/AddOns'));
const WhatsAppIntegration = lazy(() => import('../pages/Whatsapp/WhatsAppIntegration'));
const ReportsHub = lazy(() => import('../pages/ReportsHub'));
const ExpenseReportPage = lazy(() => import('../pages/Reports/ExpenseReport'));
const SalesReportPage = lazy(() => import('../pages/Reports/SalesReport'));
const CustomerReportPage = lazy(() => import('../pages/Reports/CustomerReport'));
const PnlReportPage = lazy(() => import('../pages/Reports/PNLReport'));

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

const PermissionsSettings = lazy(() => import('../pages/PermissionsSettings')); // NEW

const guarded = (permission: Permission, Component: React.ElementType): React.FC =>
  function Guarded(props: any) {
    return (
      <PermissionRoute permission={permission}>
        <Component {...props} />
      </PermissionRoute>
    );
  };

export const AppRegistry: AppModule[] = [
  {
    id: 'organizer',
    name: 'Organizer Dashboard',
    layout: 'EVENTS',
    routes: [
     { component: guarded(Permission.VIEW_DASHBOARD, EventDashboard), isIndex: true },
      { path: ROUTES.EVENTS_CREATE, component: guarded(Permission.VIEW_CREATE_EVENT, CreateEvent) },
      { path: ROUTES.EVENTS_ATTENDEES, component: guarded(Permission.VIEW_ATTENDEES, Attendees) },
      // Account, Edit Profile, Support, Add-ons, WhatsApp — always accessible, no permission gate
      { path: ROUTES.EVENTS_ACCOUNT, component: Account },
      { path: ROUTES.EVENTS_ACCOUNT_EDIT, component: EditProfile },
     { path: ROUTES.EVENTS_DISCOVER, component: guarded(Permission.VIEW_MY_EVENTS, OrganizerEventDiscover) },
      { path: ROUTES.EVENTS_DETAIL, component: guarded(Permission.VIEW_MY_EVENTS, OrganizerEventDetail) },
      { path: ROUTES.EVENTS_SETTINGS, component: guarded(Permission.VIEW_SETTINGS, SettingsHub) },
      { path: ROUTES.EVENTS_SETTINGS_EVENT, component: guarded(Permission.EDIT_EVENT_SETTINGS, EventFieldSettings) },
      { path: ROUTES.EVENTS_SETTINGS_COMPANY, component: guarded(Permission.EDIT_COMPANY_SETTINGS, CompanySettings) },
      { path: ROUTES.EVENTS_SETTINGS_APP, component: guarded(Permission.EDIT_APP_SETTINGS, AppSettings) },
      { path: ROUTES.EVENTS_SETTINGS_USERS, component: guarded(Permission.VIEW_MANAGE_USERS, ManageUsersPage) },
      { path: ROUTES.EVENTS_USER_ADD, component: guarded(Permission.ADD_USER, UserAdd) },
      { path: ROUTES.EVENTS_SETTINGS_PERMISSIONS, component: PermissionsSettings }, // owner-only check is inside the page itself
      { path: ROUTES.EVENTS_SUPPORT, component: SupportPage },
      { path: ROUTES.EVENTS_ACCOUNT_ADDONS, component: AddOns },
      { path: ROUTES.EVENTS_WHATSAPP_INTEGRATION, component: WhatsAppIntegration },
       { path: ROUTES.EVENTS_REPORTS, component: guarded(Permission.VIEW_REPORTS, ReportsHub) },
      { path: ROUTES.EVENTS_REPORTS_EXPENSE, component: guarded(Permission.VIEW_EXPENSE_REPORT, ExpenseReportPage) },
      { path: ROUTES.EVENTS_REPORTS_SALES, component: guarded(Permission.VIEW_SALES_REPORT, SalesReportPage) },
      { path: ROUTES.EVENTS_REPORTS_CUSTOMER, component: guarded(Permission.VIEW_CUSTOMER_REPORT, CustomerReportPage) },
      { path: ROUTES.EVENTS_REPORTS_PNL, component: guarded(Permission.VIEW_PNL_REPORT, PnlReportPage) },
    ],
  },
];