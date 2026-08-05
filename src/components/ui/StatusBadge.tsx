import React from 'react';
import type { EventStatus } from '../../types/event.types';

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  published: 'bg-[#007A78]/10 text-[#007A78] dark:bg-[#2DD4BF]/15 dark:text-[#2DD4BF]',
  completed: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400',
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const StatusBadge: React.FC<{ status: EventStatus }> = ({ status }) => (
  <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}>
    {STATUS_LABEL[status]}
  </span>
);

export default StatusBadge;