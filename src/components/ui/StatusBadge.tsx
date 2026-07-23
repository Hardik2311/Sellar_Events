import React from 'react';
import type { EventStatus } from '../../types/event.types';

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-orange-50 text-[#F97316]',
  completed: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-500',
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const StatusBadge: React.FC<{ status: EventStatus }> = ({ status }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}>
    {STATUS_LABEL[status]}
  </span>
);

export default StatusBadge;