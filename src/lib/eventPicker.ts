import type { EventSummary } from '../types/event.types';

/**
 * The event picker's order (EventListCard): deleted events dropped, upcoming
 * events first (soonest first), then past events (most recent first). Pages
 * use `[0]` of this as their default selection so it matches the top of the
 * dropdown.
 */
export const sortEventsForPicker = (events: EventSummary[]): EventSummary[] => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Deleted events live in their own "Deleted" tab — they must never show
  // up in this selector.
  return events
    .filter((e) => e.status !== 'deleted')
    .sort((a, b) => {
      const aDate = new Date(a.startDate).setHours(0, 0, 0, 0);
      const bDate = new Date(b.startDate).setHours(0, 0, 0, 0);
      const aUpcoming = aDate >= startOfToday.getTime();
      const bUpcoming = bDate >= startOfToday.getTime();

      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? aDate - bDate : bDate - aDate;
    });
};
