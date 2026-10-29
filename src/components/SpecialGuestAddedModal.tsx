import React, { useState } from 'react';
import { CheckCircle2, Download, Share2, X } from 'lucide-react';
import type { EventSummary } from '../types/event.types';
import { buildAcknowledgementPdf } from '../lib/ticketPdf';

export interface AddedGuest {
  name: string;
  email: string;
  phone: string;
  ticketId: string;
  tierName: string;
  guestCategory: string;
}

interface Props {
  guest: AddedGuest | null;
  event: EventSummary | null;
  eventBannerDataUrl?: string | null;
  bookMoreTicketsUrl?: string | null;
  onClose: () => void;
}

const SpecialGuestAddedModal: React.FC<Props> = ({ guest, event, eventBannerDataUrl, bookMoreTicketsUrl, onClose }) => {
  const [busy, setBusy] = useState(false);

  if (!guest || !event) return null;

  const buildPdf = () =>
    buildAcknowledgementPdf(
      {
        ticketId: guest.ticketId,
        tierName: guest.tierName,
        attendeeName: guest.name,
        attendeeEmail: guest.email,
        attendeePhone: guest.phone,
        amountPaid: 0,
        purchasedAt: Date.now(),
        isComplimentary: true,
      },
      {
        eventTitle: event.title,
        eventCategory: event.category,
        eventDate: event.startDate,
        eventTime: event.time,
        eventVenue: event.venue,
        eventBannerDataUrl,
        eventConsentText: event.consentText,
        eventGoodToKnowText: event.goodToKnowText,
        eventIsOnline: event.isOnline,
        eventIsPrivate: event.isPrivate,
        eventArriveBy: event.arriveByTime,
        eventAgeLimit: event.ageLimit,
        eventHelplineNumber: event.helplineNumber,
        bookMoreTicketsUrl,
      },
      null // QR is drawn from the ticket ID, no canvas needed
    );

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const doc = await buildPdf();
      doc.save(`${guest.ticketId}-receipt.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const doc = await buildPdf();
      const file = new File([doc.output('blob')], `${guest.ticketId}-receipt.pdf`, { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return; // user closed the share sheet
        }
      }
      doc.save(file.name); // browsers without file sharing: download instead
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-sm bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Close">
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <h2 className="mt-2 text-base font-extrabold text-slate-900 dark:text-white">Special guest added</h2>
          <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">{guest.name}</p>
          <span className="mt-1 rounded-sm border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-400/10 dark:text-yellow-300">
            {guest.guestCategory}
          </span>
          <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">{guest.ticketId}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleShare}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[#007A78] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#006361] disabled:opacity-50 cursor-pointer dark:bg-[#2DD4BF] dark:text-slate-950"
          >
            <Share2 size={14} /> {busy ? 'Preparing…' : 'Share ticket'}
          </button>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex items-center justify-center rounded-sm border border-slate-300 px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Download ticket"
            aria-label="Download ticket"
          >
            <Download size={16} />
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-sm px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default SpecialGuestAddedModal;