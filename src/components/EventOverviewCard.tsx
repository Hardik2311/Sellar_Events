import React from 'react';
import type { EventSummary } from '../types/event.types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import StatusBadge from './ui/StatusBadge';

interface EventOverviewCardProps {
  event: EventSummary | null;
  isDataVisible: boolean;
  loading?: boolean;
}

/**
 * Mirrors CompletedSalesCard's visual language: text-base font-semibold
 * title, a large colored stat number, small gray-500 supporting line.
 */
export const EventOverviewCard: React.FC<EventOverviewCardProps> = ({ event, isDataVisible, loading = false }) => {
  if (!event) {
    return (
      <Card className="shadow-sm border-gray-200">
        <CardContent className="flex items-center justify-center min-h-[160px] text-sm text-gray-500 pt-6">
          Select an event to see its overview
        </CardContent>
      </Card>
    );
  }

  const formattedDate = new Date(event.startDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-gray-900">{event.title}</CardTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            {formattedDate} · {event.venue}
          </p>
        </div>
        <StatusBadge status={event.status} />
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tickets Sold</p>
          {loading ? (
            <div className="h-8 w-20 mx-auto animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="text-2xl sm:text-3xl font-extrabold text-[#007A78] dark:text-[#2DD4BF]">
              {isDataVisible ? `${event.ticketsSold}/${event.ticketsTotal}` : '••••'}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Total Revenue</p>
          {loading ? (
            <div className="h-8 w-20 mx-auto animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="text-2xl sm:text-3xl font-extrabold text-[#007A78] dark:text-[#2DD4BF]">
              {isDataVisible ? `₹${event.revenue.toLocaleString('en-IN')}` : '••••'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EventOverviewCard;