import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Wifi, Share2, Ticket, User, Pencil } from 'lucide-react';
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
import type { EventFormState } from '../types/event.types';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import { buildEventSlugId } from '../data/events';

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
          status: d.status,
          featured: d.featured || false,
          tiers: (d.tiers || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            quantity: t.quantity,
            sold: t.sold || 0,
          })),
          // NEW
          registrationMode: d.registrationMode || 'tickets',
          rsvpLink: d.rsvpLink || '',
          rsvpButtonLabel: d.rsvpButtonLabel || 'RSVP Now',
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
  const { event: rawEvent, loading } = useEvent(profile?.companyId, id);
  const event = rawEvent ? { ...rawEvent, organizerName: profile?.organizationName || '' } : undefined;
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleShareEvent = async () => {
    if (!event) return;

    const slugId = buildEventSlugId(event.title, event.id);

    // Safe fallback in case the organizer hasn't claimed a subdomain yet —
    // points at the public customer route, ends in the readable title
    let shareUrl = `${window.location.origin}/e/${slugId}`;

    try {
      if (profile?.companyId) {
        const companySnap = await getDoc(doc(db, 'companies', profile.companyId));
        if (companySnap.exists() && companySnap.data().subdomain) {
          shareUrl = `https://${companySnap.data().subdomain}.sellar.in/e/${slugId}`;
        }
      }
    } catch (error) {
      console.error('Error fetching subdomain for sharing:', error);
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `Check out ${event.title}${event.organizerName ? ` by ${event.organizerName}` : ''} on Sellar Events`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (error) {
      console.log('Share cancelled:', error);
    }
  };

  const handleSaveEdit = async (updated: EventFormState) => {
    if (!profile?.companyId || !id) return;

    // Each entry is either an existing https URL (kept as-is) or a fresh
    // base64 data URL (newly picked file) that needs uploading.
    const coverImageUrls: string[] = await Promise.all(
      updated.images.map(async (img, i) => {
        if (!img.startsWith('data:')) return img;
        const imageRef = ref(storage, `companies/${profile.companyId}/events/${id}/photo-${i}.jpg`);
        await uploadString(imageRef, img, 'data_url');
        return getDownloadURL(imageRef);
      })
    );

    const isRsvp = updated.registrationMode === 'rsvp';

    await updateDoc(doc(db, 'companies', profile.companyId, 'events', id), {
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
      registrationMode: updated.registrationMode,
      tiers: isRsvp ? [] : updated.tiers,
      rsvpLink: isRsvp ? updated.rsvpLink.trim() : null,
      rsvpButtonLabel: isRsvp ? (updated.rsvpButtonLabel.trim() || 'RSVP Now') : null,
      updatedAt: serverTimestamp(),
    });
    setIsEditOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-gray-100 p-6 text-center">
        <Ticket size={28} className="text-gray-300" />
        <p className="text-sm font-medium text-slate-700">This event doesn&rsquo;t exist.</p>
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
    <div className="flex min-h-screen w-full flex-col bg-gray-100 mb-16">
      {/* ── Header / hero ───────────────────────────────────────────── */}
      <div className={`relative h-64 w-full shrink-0 bg-gradient-to-br ${gradient}`}>
        {event.images?.[0] && (
          <img src={event.images[0]} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-sm border border-white/40 bg-white/90 p-2 hover:bg-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5 rounded-sm border border-white/40 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={handleShareEvent}
              className="rounded-sm border border-white/40 bg-white/90 p-2 hover:bg-white transition-colors"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="mb-2 inline-block w-fit rounded-sm bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            {label}
          </span>
          <h1 className="text-2xl font-bold text-white">{event.title}</h1>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="grow overflow-y-auto p-2">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* Key details */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="mt-0.5 shrink-0 text-[#007A78]" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatDateRange(event.date, event.endDate)}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={12} /> {formatTime(event.time)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {event.isOnline ? (
                  <Wifi size={18} className="mt-0.5 shrink-0 text-[#007A78]" />
                ) : (
                  <MapPin size={18} className="mt-0.5 shrink-0 text-[#007A78]" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800">{event.isOnline ? 'Online event' : event.venue}</p>
                  {event.isOnline && <p className="text-xs text-slate-500">Link shared with ticket holders before the event</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User size={18} className="mt-0.5 shrink-0 text-[#007A78]" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{event.organizerName}</p>
                  <p className="text-xs text-slate-500">Organizer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {event.images && event.images.length > 1 && (
            <Card className="shadow-sm border-gray-200">
              <CardContent className="pt-4">
                <h2 className="mb-2 text-base font-semibold text-gray-900">Photos</h2>
                <div className="grid grid-cols-4 gap-2">
                  {event.images.map((src, i) => (
                    <img key={i} src={src} className="aspect-square rounded-md object-cover" alt={`${event.title} photo ${i + 1}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {/* About */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              <h2 className="mb-2 text-base font-semibold text-gray-900">About this event</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{event.description}</p>
            </CardContent>
          </Card>

          {/* Registration — ticket tiers, or the RSVP link if this is an RSVP event */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="pt-4">
              {event.registrationMode === 'rsvp' ? (
                <>
                  <h2 className="mb-3 text-base font-semibold text-gray-900">RSVP</h2>
                  <p className="mb-3 text-sm text-slate-600">
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
                    <p className="text-xs text-red-500">No RSVP link set yet — add one via Edit.</p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-base font-semibold text-gray-900">Ticket tiers</h2>
                  <div className="flex flex-col divide-y divide-gray-100">
                    {event.tiers.map((tier) => (
                      <div key={tier.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{tier.name}</p>
                          <p className="text-sm font-semibold text-[#007A78]">
                            {tier.price === 0 ? 'Free' : `\u20B9${tier.price.toLocaleString('en-IN')}`}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400">
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
      {isEditOpen && (
        <EditEventModal
          event={event}
          onClose={() => setIsEditOpen(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div >
  );
};

export default OrganizerEventDetail;