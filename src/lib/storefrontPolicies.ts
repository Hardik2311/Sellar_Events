// Storefront policies (refund, terms, privacy) that each organizer edits in
// Settings → Storefront & policies and that buyers read on /policies/:policy.
// Until an organizer saves their own text, the storefront shows these
// templates with the organizer's name filled in.

export type StorefrontPolicyKey = 'refund' | 'terms' | 'privacy';

export const STOREFRONT_POLICY_KEYS: StorefrontPolicyKey[] = ['refund', 'terms', 'privacy'];

export const STOREFRONT_POLICY_LABELS: Record<StorefrontPolicyKey, string> = {
  refund: 'Refund policy',
  terms: 'Terms and conditions',
  privacy: 'Privacy policy',
};

// Shorter labels for the footer's Help column.
export const STOREFRONT_POLICY_LINK_LABELS: Record<StorefrontPolicyKey, string> = {
  refund: 'Refund policy',
  terms: 'Terms',
  privacy: 'Privacy',
};

export const isStorefrontPolicyKey = (value: string | undefined): value is StorefrontPolicyKey =>
  !!value && (STOREFRONT_POLICY_KEYS as string[]).includes(value);

const ORG_TOKEN = '{organizer}';

const POLICY_TEMPLATES: Record<StorefrontPolicyKey, string> = {
  refund: `Tickets bought from ${ORG_TOKEN} are non-refundable unless the event page says otherwise.

If ${ORG_TOKEN} cancels an event, you get a full refund of the ticket price to your original payment method within 7 to 10 working days.

If an event is rescheduled, your ticket stays valid for the new date. If you can't make the new date, write to us within 7 days of the announcement to ask for a refund.

Booking and payment gateway fees are not refundable.

To ask about a refund, write to us with your ticket ID and the name on the booking.`,

  terms: `These terms apply to every ticket booked on the ${ORG_TOKEN} event pages.

Tickets
Each ticket admits the person named on it, once. Keep your QR code private: the first scan at entry is the one that counts.

Tickets can't be resold or transferred unless ${ORG_TOKEN} allows it for a specific event.

Entry
Carry a valid photo ID that matches the name on the ticket. Entry may be refused to anyone who doesn't meet the event's age limit or entry rules.

${ORG_TOKEN} may refuse entry to, or remove, anyone whose behaviour puts other guests, staff or the venue at risk. No refund is given in that case.

Changes to events
Line-ups, timings and venues can change. We'll tell ticket holders about major changes using the contact details given at booking.

Your belongings
${ORG_TOKEN} and the venue aren't responsible for lost or damaged personal belongings.

Photos and video
Events may be photographed or filmed. By attending, you agree that you may appear in this content.

Payments
Ticketing and payments are processed through Outsold on behalf of ${ORG_TOKEN}.`,

  privacy: `${ORG_TOKEN} collects the details you enter when you book: your name, phone number, email and any answers to the event's questions.

How we use it
To issue and check your tickets, contact you about the event you booked, and handle refunds or support requests.

Who sees it
Your details are visible to the ${ORG_TOKEN} team running the event. Ticketing and payments are handled by Outsold and its payment partners, who use your details only to complete the booking. We don't sell your personal data.

How long we keep it
We keep booking records for as long as the event, accounting and legal requirements need them.

Your choices
You can ask us to correct or delete your details by writing to us.`,
};

export const fillOrganizer = (text: string, organizationName?: string) =>
  text.split(ORG_TOKEN).join(organizationName?.trim() || 'the organizer');

export const getPolicyTemplate = (key: StorefrontPolicyKey, organizationName?: string) =>
  fillOrganizer(POLICY_TEMPLATES[key], organizationName);

// The organizer's saved text, or the template when they haven't written one.
export const resolvePolicyText = (key: StorefrontPolicyKey, saved: string | undefined, organizationName?: string) =>
  saved && saved.trim() ? saved : getPolicyTemplate(key, organizationName);

export type PolicyBlock = { type: 'heading' | 'paragraph'; text: string };

// Plain text -> blocks. Paragraphs are separated by blank lines; a short line
// on its own (no full stop at the end) becomes a heading, and lines that follow
// a heading without a blank line become its first paragraph.
export const toPolicyBlocks = (text: string): PolicyBlock[] => {
  const blocks: PolicyBlock[] = [];
  text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const [first, ...rest] = chunk.split('\n');
      const looksLikeHeading = first.length <= 60 && !/[.!?:,;]$/.test(first.trim());
      if (looksLikeHeading && (rest.length > 0 || chunk === first)) {
        blocks.push({ type: 'heading', text: first.trim() });
        if (rest.length > 0) blocks.push({ type: 'paragraph', text: rest.join('\n').trim() });
      } else {
        blocks.push({ type: 'paragraph', text: chunk });
      }
    });
  return blocks;
};
