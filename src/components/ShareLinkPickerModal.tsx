import React from 'react';
import { buildEventSlugId } from '../data/events';
import { ShareOptionsModal } from './ShareOptionsModal';
import type { EventSummary } from '../types/event.types';
import { ROUTES } from '../constants/routes.constants';

interface ShareLinkPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventSummary[];
  eventsLoading: boolean;
}

export const ShareLinkPickerModal: React.FC<ShareLinkPickerModalProps> = ({
  isOpen,
  onClose,
  events,
  eventsLoading,
}) => {
  // No picker UI — just share whatever event is available (first/active one).
  const shareEvent = events[0] ?? null;

  const getDiscoverUrl = (event: EventSummary) =>
    `${window.location.origin}${ROUTES.EVENT_DETAIL.replace(':slug', buildEventSlugId(event.title, event.id))}`;

  if (!isOpen) return null;

  if (!eventsLoading && !shareEvent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="w-full max-w-xs rounded-sm bg-white dark:bg-slate-800 p-4 shadow-xl text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            No events found. Add a new event to share.
          </p>
          <button
            onClick={onClose}
            className="rounded-sm border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (eventsLoading || !shareEvent) return null;

  return (
    <ShareOptionsModal
      isOpen={isOpen}
      onClose={onClose}
      shareUrl={getDiscoverUrl(shareEvent)}
      onViewStore={() => {
        window.open(`${window.location.origin}${ROUTES.DISCOVER}`, '_blank', 'noopener,noreferrer');
      }}
    />
  );
};