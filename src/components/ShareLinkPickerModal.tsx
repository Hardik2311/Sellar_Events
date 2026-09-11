import React, { useEffect, useState } from 'react';
import { getShareBaseUrl } from '../lib/shareLinks';
import { ShareOptionsModal } from './ShareOptionsModal';
import type { EventSummary } from '../types/event.types';

interface ShareLinkPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventSummary[]; // kept for future use (e.g. showing event count), no longer used to build the shared URL
  eventsLoading: boolean;
  companyId?: string;
}

export const ShareLinkPickerModal: React.FC<ShareLinkPickerModalProps> = ({
  isOpen,
  onClose,
  eventsLoading,
  companyId,
}) => {
  const [storeBaseUrl, setStoreBaseUrl] = useState(window.location.origin);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    getShareBaseUrl(companyId).then(setStoreBaseUrl);
  }, [isOpen, companyId]);

  if (!isOpen) return null;
  if (eventsLoading) return null;

   return (
    <ShareOptionsModal
      isOpen={isOpen}
      onClose={onClose}
      shareUrl={storeBaseUrl}
      onViewStore={() => {
        window.open(storeBaseUrl, '_blank', 'noopener,noreferrer');
      }}
    />
  );
};