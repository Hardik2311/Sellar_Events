import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Wifi, Share2, Ticket, User, Pencil, CheckCircle, X } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Card, CardContent } from '../components/ui/card';
import {
  CATEGORY_GRADIENTS,
  getCategoryLabel,
  formatDateRange,
  formatTime,
  type PublicEvent,
} from '../data/events';
import EditEventModal from '../components/EditEventModal';
import CoverImageDisplay from '../components/ui/CoverImageDisplay';
import { DEFAULT_TEXT_STYLE, type EventFormState } from '../types/event.types';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import { buildEventSlugId } from '../data/events';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/permissions.types';
import { stripHtmlTags } from '../lib/utils';

// Real-time single event listener
const useEvent = (companyId?: string, id?: string) => {
  const [event, setEvent] = useState<PublicEvent | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !id) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'companies', companyId, 'events', id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setEvent({
          id: snap.id,
          companyId,
          title: d.title,
          category: d.category,
          description: d.description,
          date: d.date,
          endDate: d.endDate,
          time: d.time,
          venue: d.venue || '',
          isOnline: d.isOnline,
          organizerName: '', // niche component profile se overwrite karega
          coverImage: d.coverImageUrls?.[0] || d.coverImageUrl || null,
          images: d.coverImageUrls || (d.coverImageUrl ? [d.coverImageUrl] : []),
          coverImageDesktop: d.coverImageDesktop ?? null,
          coverImageMobile: d.coverImageMobile ?? null,
          pastEventsGallery: d.pastEventsGallery ?? [],
          status: d.status,
          featured: d.featured || false,
          tiers: (d.tiers || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            quantity: t.quantity,
            sold: t.sold || 0,
            dummyRemaining: typeof t.dummyRemaining === 'number' ? t.dummyRemaining : null,
            tierEndDate: t.tierEndDate ?? null,
            tierEndTime: t.tierEndTime ?? null,
          })),
          // NEW
          registrationMode: d.registrationMode || 'tickets',
          rsvpLink: d.rsvpLink || '',
          rsvpButtonLabel: d.rsvpButtonLabel || 'RSVP Now',
          customFields: d.customFields || [],
          titleStyle: d.titleStyle ?? undefined,
          descriptionStyle: d.descriptionStyle ?? undefined,
          consentText: d.consentText ?? undefined,
          consentStyle: d.consentStyle ?? undefined,
        });
      } else {
        setEvent(undefined);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [companyId, id]);

  return { event, loading };
};

const OrganizerEventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const { event: rawEvent, loading } = useEvent(profile?.companyId, id);
  const event = rawEvent ? { ...rawEvent, organizerName: profile?.organizationName || '' } : undefined;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setActiveImageIndex(0); // event change hone par reset
  }, [event?.id]);

  const goToPrevImage = () => {
    if (!event?.images?.length) return;
    setActiveImageIndex((i) => (i - 1 + event.images.length) % event.images.length);
  };

  const goToNextImage = () => {
    if (!event?.images?.length) return;
    setActiveImageIndex((i) => (i + 1) % event.images.length);
  };

  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [linkCopiedToast, setLinkCopiedToast] = useState(false); // NEW — separate toast from "event updated"

  useEffect(() => {
    if (!showSaveConfirmation) return;
    const t = setTimeout(() => setShowSaveConfirmation(false), 2000);
    return () => clearTimeout(t);
  }, [showSaveConfirmation]);

  useEffect(() => {
    if (!linkCopiedToast) return;
    const t = setTimeout(() => setLinkCopiedToast(false), 2000);
    return () => clearTimeout(t);
  }, [linkCopiedToast]);

  // Direct share — resolves the (possibly subdomain-based) event URL, then
  // uses the native share sheet when available, else copies the link.
  const resolveShareUrl = async () => {
    if (!event) return '';
    const slugId = buildEventSlugId(event.title, event.id);
    let shareUrl = `${window.location.origin}/e/${slugId}`;
    try {
      if (profile?.companyId) {
        const companySnap = await getDoc(doc(db, 'companies', profile.companyId));
        if (companySnap.exists() && companySnap.data().subdomain) {
          shareUrl = `https://${companySnap.data().subdomain}.outsold.in/e/${slugId}`;
        }
      }
    } catch (error) {
      console.error('Error fetching subdomain for sharing:', error);
    }
    return shareUrl;
  };

  const handleOpenShare = async () => {
    if (!event) return;
    const shareUrl = await resolveShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url: shareUrl });
        return;
      } catch {
        return; // user cancelled share sheet, no-op
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopiedToast(true);
  };
  // Small helper — uploads a base64 data URL if needed, otherwise keeps existing https URL as-is
  const uploadIfNeeded = async (img: string | null, filename: string): Promise<string | null> => {
    if (!img) return null;
    if (!img.startsWith('data:')) return img;
    const imageRef = ref(storage, `companies/${profile!.companyId}/events/${id}/${filename}.jpg`);
    await uploadString(imageRef, img, 'data_url');
    return getDownloadURL(imageRef);
  };

  const handleSaveEdit = async (updated: EventFormState) => {
    if (!profile?.companyId || !id || !event) return;

    const coverImageUrls: string[] = await Promise.all(
      updated.images.map((img, i) => uploadIfNeeded(img, `photo-${i}`) as Promise<string>)
    );

    // NEW — these were captured on the form but never uploaded/saved before
    const [coverImageDesktopUrl, coverImageMobileUrl] = await Promise.all([
      uploadIfNeeded(updated.coverImageDesktop, 'cover-desktop'),
      uploadIfNeeded(updated.coverImageMobile, 'cover-mobile'),
    ]);

    const isRsvp = updated.registrationMode === 'rsvp';

    // NEW — upload the QR image the same way cover images are uploaded
    const isManualQR = updated.registrationMode === 'tickets' && updated.paymentCollectionMode === 'manual_qr';
    //const qrImageUrl = isManualQR ? await uploadIfNeeded(updated.qrImage, 'payment-qr') : null;

        // Strip any `undefined` values — Firestore rejects the whole write
    // if even one field is undefined, which was silently killing saves.
    const sanitize = <T,>(obj: T): T =>
      JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));

    try {
      const payload = sanitize({
        title: updated.title,
        category: updated.category === 'Other' ? updated.customCategory : updated.category,
        description: updated.description,
        date: updated.date,
        endDate: updated.endDate,
        time: updated.time,
        venue: updated.isOnline ? null : updated.venue,
        isOnline: updated.isOnline,
        coverImageUrl: coverImageUrls[0] ?? null,
        coverImageUrls,
        coverImageDesktop: coverImageDesktopUrl,
        coverImageMobile: coverImageMobileUrl,
        registrationMode: updated.registrationMode,
        tiers: isRsvp ? [] : updated.tiers,
        rsvpLink: isRsvp ? updated.rsvpLink.trim() : null,
        rsvpButtonLabel: isRsvp ? (updated.rsvpButtonLabel.trim() || 'RSVP Now') : null,
        titleStyle: { ...DEFAULT_TEXT_STYLE, ...event.titleStyle, fontSize: updated.titleFontSize },
        descriptionStyle: { ...DEFAULT_TEXT_STYLE, ...event.descriptionStyle, fontSize: updated.descriptionFontSize },
        consentText: updated.consentText.trim() || null,
        consentStyle: updated.consentText.trim()
          ? { ...DEFAULT_TEXT_STYLE, ...event.consentStyle, fontSize: updated.consentFontSize }
          : null,
        paymentCollectionMode: updated.registrationMode === 'tickets' ? updated.paymentCollectionMode : null,
        upiId: isManualQR ? updated.upiId.trim() : null,
        payeeName: isManualQR ? updated.payeeName.trim() : null,
      });

      await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), {
        ...payload,
        updatedAt: serverTimestamp(), // added after sanitize — serverTimestamp() sentinel must not go through JSON.stringify
      });

      setIsEditOpen(false);          // close edit modal
      setShowSaveConfirmation(true); // show success confirmation
    } catch (err) {
      console.error('Failed to save event:', err);
      // TODO: surface a user-facing error toast instead of failing silently
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 dark:bg-[#0F172A]">
        <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-[#0F172A] p-6 text-center">
        <Ticket size={28} className="text-gray-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">This event doesn&rsquo;t exist.</p>
        <button
          onClick={() => navigate('/events/discover')}
          className="rounded-md bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361]"
        >
          Back to events
        </button>
      </div>
    );
  }

  const label = getCategoryLabel(event);
  const gradient = CATEGORY_GRADIENTS[event.category] ?? CATEGORY_GRADIENTS.Other;

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 dark:bg-[#0F172A] mb-16">
      {/* ── Header / hero ───────────────────────────────────────────── */}
      <div className={`relative h-64 w-full shrink-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
        {(event.coverImageDesktop || event.coverImageMobile) ? (
          <CoverImageDisplay desktopSrc={event.coverImageDesktop} mobileSrc={event.coverImageMobile} alt={event.title} />
        ) : event.images && event.images.length > 0 && (
          <>
            {event.images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={`${event.title} photo ${i + 1}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === activeImageIndex ? 'opacity-100' : 'opacity-0'
                  }`}
              />
            ))}
            {event.images.length > 1 && (
              <>
                <button
                  onClick={goToPrevImage}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
                  aria-label="Previous photo"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors rotate-180"
                  aria-label="Next photo"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="absolute bottom-14 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                  {event.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${i === activeImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                        }`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <BackButton className="border-white/40 bg-white/90 hover:bg-white" />
            {can(Permission.EDIT_EVENT) && (
              <button
                onClick={() => setIsEditOpen(true)}
                className="flex items-center gap-1.5 rounded-sm border border-white/40 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>
          <button
            onClick={handleOpenShare}
            className="rounded-sm border border-white/40 bg-white/90 p-2 text-slate-700 hover:bg-white transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div><div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <BackButton className="border-white/40 bg-white/90 hover:bg-white" />
            {can(Permission.EDIT_EVENT) && (
              <button
                onClick={() => setIsEditOpen(true)}
                className="flex items-center gap-1.5 rounded-sm border border-white/40 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>
          <button
            onClick={handleOpenShare}
            className="rounded-sm border border-white/40 bg-white/90 p-2 text-slate-700 hover:bg-white transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="mb-2 inline-block w-fit rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            {label}
          </span>
          <h1 className="text-2xl font-bold text-white">{stripHtmlTags(event.title)}</h1>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* Key details */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatDateRange(event.date, event.endDate)}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Clock size={12} /> {formatTime(event.time)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {event.isOnline ? (
                  <Wifi size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                ) : (
                  <MapPin size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.isOnline ? 'Online event' : event.venue}</p>
                  {event.isOnline && <p className="text-xs text-slate-500 dark:text-slate-400">Link shared with ticket holders before the event</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User size={18} className="mt-0.5 shrink-0 text-[#007A78] dark:text-[#2DD4BF]" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.organizerName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Organizer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* About */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="pt-4">
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-slate-100">About this event</h2>
              <p className="whitespace-pre-line leading-relaxed mb-3 break-words">{stripHtmlTags(event.description)}</p>
            </CardContent>
          </Card>

          {event.pastEventsGallery && event.pastEventsGallery.length > 0 && (
            <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
              <CardContent className="pt-4">
                <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">Past Events</h2>
                <div className="grid grid-cols-3 gap-2">
                  {event.pastEventsGallery.slice(0, 6).map((item, i) => {
                    const remaining = event.pastEventsGallery.length - 6;
                    const isLastVisible = i === 5 && remaining > 0;
                    return (
                      <button
                        key={item.url + i}
                        onClick={() => setLightboxIndex(i)}
                        className="group relative aspect-square overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800"
                      >
                        {item.type === 'video' ? (
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <img src={item.url} alt={`Past event ${i + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        )}
                        {isLastVisible && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                            +{remaining} more
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lightbox */}
          {lightboxIndex !== null && event.pastEventsGallery && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxIndex(null)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
                className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                aria-label="Close"
              >
                <X size={20} />
              </button>
              {event.pastEventsGallery.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i! - 1 + event.pastEventsGallery.length) % event.pastEventsGallery.length); }}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                    aria-label="Previous"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i! + 1) % event.pastEventsGallery.length); }}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 rotate-180"
                    aria-label="Next"
                  >
                    <ArrowLeft size={20} />
                  </button>
                </>
              )}
              <div className="max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                {event.pastEventsGallery[lightboxIndex].type === 'video' ? (
                  <video src={event.pastEventsGallery[lightboxIndex].url} className="max-h-[85vh] max-w-[90vw]" controls autoPlay />
                ) : (
                  <img
                    src={event.pastEventsGallery[lightboxIndex].url}
                    alt={`Past event ${lightboxIndex + 1}`}
                    className="max-h-[85vh] max-w-[90vw] object-contain"
                  />
                )}
              </div>
            </div>
          )}

          {/* Registration — ticket tiers, or the RSVP link if this is an RSVP event */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
            <CardContent className="pt-4">
              {event.registrationMode === 'rsvp' ? (
                <>
                  <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">RSVP</h2>
                  <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                    Attendees register through an external form instead of buying a ticket.
                  </p>
                  {event.rsvpLink ? (
                    <a
                      href={event.rsvpLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#007A78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006361]"
                    >
                      {event.rsvpButtonLabel || 'RSVP Now'}
                    </a>
                  ) : (
                    <p className="text-xs text-red-500 dark:text-red-400">No RSVP link set yet — add one via Edit.</p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">Ticket tiers</h2>
                  <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
                    {event.tiers.map((tier) => (
                      <div key={tier.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{tier.name}</p>
                          <p className="text-sm font-semibold text-[#007A78]">
                            {tier.price === 0 ? 'Free' : `\u20B9${tier.price.toLocaleString('en-IN')}`}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {tier.sold} / {tier.quantity} sold
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main >
      {isEditOpen && can(Permission.EDIT_EVENT) && (
        <EditEventModal
          event={event}
          onClose={() => setIsEditOpen(false)}
          onSave={handleSaveEdit}
        />
      )}
      {showSaveConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-lg bg-white dark:bg-slate-800 p-6 text-center shadow-xl">
            <CheckCircle size={40} className="text-[#007A78] dark:text-[#2DD4BF]" />
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Event updated successfully</p>
          </div>
        </div>
      )}

      {/* NEW — link copied toast */}
      {linkCopiedToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          Link copied to clipboard!
        </div>
      )}

    </div >
  );
};

export default OrganizerEventDetail;