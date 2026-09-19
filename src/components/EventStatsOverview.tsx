import React, { useMemo } from 'react';
import { IndianRupee, Ticket, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import StatusBadge from './ui/StatusBadge';
import { useAttendees } from '../hooks/useAttendees';
import { CONFIRMED_TICKET_STATUSES } from '../types/attendee.types';
import { stripHtmlTags } from '../lib/utils';
import type { EventSummary } from '../types/event.types';

interface EventStatsOverviewProps {
  companyId: string | undefined;
  event: EventSummary | null;
  isDataVisible: boolean;
  loading?: boolean;
}

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  hidden: boolean;
  loading: boolean;
}

const StatTile: React.FC<StatTileProps> = ({ icon: Icon, label, value, sub, hidden, loading }) => (
  <Card className="shadow-sm border-gray-200">
    <CardContent className="px-3.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <span className="shrink-0 h-7 w-7 rounded-full bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF] flex items-center justify-center">
          <Icon size={14} />
        </span>
      </div>

      {loading ? (
        <div className="h-7 w-20 mt-2 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-700" />
      ) : (
        <p className="mt-1.5 text-2xl font-extrabold text-slate-900 dark:text-white">
          {hidden ? '••••' : value}
        </p>
      )}

      {sub && !loading && (
        <p className="mt-1 text-xs font-semibold text-[#007A78] dark:text-[#2DD4BF]">
          {hidden ? '••' : sub}
        </p>
      )}
    </CardContent>
  </Card>
);

export const EventStatsOverview: React.FC<EventStatsOverviewProps> = ({
  companyId,
  event,
  isDataVisible,
  loading = false,
}) => {
  const { attendees, loading: attendeesLoading } = useAttendees(companyId, event?.id);

  const { confirmedCount, confirmedPct, conversionPct } = useMemo(() => {
    const confirmed = attendees.filter((a) => CONFIRMED_TICKET_STATUSES.has(a.status));
    const checkedIn = attendees.filter((a) => a.status === 'checked_in');
    const confirmedPctCalc = confirmed.length > 0 ? Math.round((checkedIn.length / confirmed.length) * 1000) / 10 : 0;
    const conversionPctCalc =
      event && event.ticketsTotal > 0 ? Math.round((event.ticketsSold / event.ticketsTotal) * 1000) / 10 : 0;

    return { confirmedCount: confirmed.length, confirmedPct: confirmedPctCalc, conversionPct: conversionPctCalc };
  }, [attendees, event]);

  if (!event) {
    return (
      <Card className="shadow-sm border-gray-200">
        <CardContent className="flex items-center justify-center min-h-[120px] text-sm text-gray-500 pt-6">
          Select an event to see its overview
        </CardContent>
      </Card>
    );
  }

  const isLoading = loading || attendeesLoading;
  const formattedDate = new Date(event.startDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          icon={IndianRupee}
          label="Revenue"
          value={`₹${event.revenue.toLocaleString('en-IN')}`}
          hidden={!isDataVisible}
          loading={isLoading}
        />
        <StatTile
          icon={Ticket}
          label="Tickets Sold"
          value={event.ticketsSold.toLocaleString('en-IN')}
          sub={`of ${event.ticketsTotal.toLocaleString('en-IN')} tickets`}
          hidden={!isDataVisible}
          loading={isLoading}
        />
        <StatTile
          icon={Users}
          label="Attendees"
          value={confirmedCount.toLocaleString('en-IN')}
          sub={`${confirmedPct}% confirmed`}
          hidden={!isDataVisible}
          loading={isLoading}
        />
        <StatTile
          icon={TrendingUp}
          label="Conversion"
          value={`${conversionPct}%`}
          hidden={!isDataVisible}
          loading={isLoading}
        />
      </div>
    </div>
  );
};

export default EventStatsOverview;