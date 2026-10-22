import { httpsCallable } from 'firebase/functions';
import type { jsPDF } from 'jspdf';
import { paymentFunctions } from './firebase';

// Browser side of Super Admin → Send Tickets. The PDFs are built here (same
// code as the in-app download); functions/email/sendTicketEmail.js sends them
// from the platform Gmail account and records ticketEmail on each attendee.

export interface SendTicketEmailInput {
  companyId: string;
  eventId: string;
  attendeeIds: string[]; // attendee doc ids — must all share one email
  pdfs: { filename: string; base64: string }[];
  test?: boolean;        // send to the platform inbox instead; nothing recorded
}

export const sendTicketEmail = async (input: SendTicketEmailInput) => {
  const call = httpsCallable<SendTicketEmailInput, { success: boolean; to: string; test: boolean }>(
    paymentFunctions,
    'sendTicketEmail',
  );
  return (await call(input)).data;
};

export const markTicketEmails = async (input: {
  companyId: string;
  eventId: string;
  ticketIds: string[];
  action: 'sent' | 'clear';
}) => {
  const call = httpsCallable<typeof input, { success: boolean; updated: number; notFound: string[] }>(
    paymentFunctions,
    'markTicketEmails',
  );
  return (await call(input)).data;
};

export const pdfToBase64 = (doc: jsPDF): string => doc.output('datauristring').split(',')[1] ?? '';
