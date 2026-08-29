import React, { useState, useMemo } from 'react';
import { buildEventSlugId } from '../data/events';
import { buildWhatsAppShareText, openWhatsAppShare } from '../lib/whatsappShare';
import { useCompanySettings } from '../hooks/useSettings';
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
  const { settings } = useCompanySettings();

  // No picker UI — just share whatever event is available (first/active one).
  const shareEvent = events[0] ?? null;

  const getDiscoverUrl = (event: EventSummary) =>
    `${window.location.origin}${ROUTES.EVENT_DETAIL.replace(':slug', buildEventSlugId(event.title, event.id))}`;

  if (!isOpen || eventsLoading || !shareEvent) return null;

  return (
    <ShareOptionsModal
      isOpen={isOpen}
      onClose={onClose}
      shareUrl={getDiscoverUrl(shareEvent)}
      onWhatsAppShare={() => {
        const text = buildWhatsAppShareText(settings.whatsappShareTemplate, shareEvent.title, getDiscoverUrl(shareEvent));
        openWhatsAppShare(text);
      }}
    />
  );
};