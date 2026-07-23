import type { Attendee } from '../types/attendee.types';

const NAMES = [
  'Rahul Verma', 'Anita Sharma', 'Priya Singh', 'Karan Mehta', 'Sneha Gupta',
  'Vikram Rao', 'Neha Kapoor', 'Arjun Nair', 'Divya Iyer', 'Rohan Bhatia',
  'Isha Malhotra', 'Aditya Joshi', 'Pooja Reddy', 'Sameer Khan', 'Tanvi Desai',
];

const makeAttendee = (index: number, eventId: string, tierName: string, status: Attendee['status']): Attendee => {
  const name = NAMES[index % NAMES.length];
  const id = `att-${eventId}-${index}`;
  return {
    id,
    eventId,
    name,
    email: `${name.split(' ')[0].toLowerCase()}${index}@example.com`,
    phone: `98765${(10000 + index).toString().slice(-5)}`,
    tierName,
    ticketId: `TCK-${eventId.toUpperCase()}-${1000 + index}`,
    status,
    checkedInAt: status === 'checked_in' ? new Date(Date.now() - index * 15 * 60 * 1000).toISOString() : null,
  };
};

// evt-1: Open Mic Comedy Night — 142 sold, mostly checked in (it's the "live" one)
const evt1Attendees: Attendee[] = [
  ...Array.from({ length: 25 }, (_, i) => makeAttendee(i, 'evt-1', i % 5 === 0 ? 'Front row' : 'General', 'checked_in')),
  ...Array.from({ length: 15 }, (_, i) => makeAttendee(i + 25, 'evt-1', i % 4 === 0 ? 'Front row' : 'General', 'valid')),
  makeAttendee(40, 'evt-1', 'General', 'cancelled'),
];

// evt-2: College Music Fest — 340 sold, none checked in yet (upcoming)
const evt2Attendees: Attendee[] = Array.from({ length: 20 }, (_, i) =>
  makeAttendee(i, 'evt-2', i % 6 === 0 ? 'VIP' : 'General', 'valid')
);

// evt-3: Startup Founders Meetup — draft, no attendees yet
const evt3Attendees: Attendee[] = [];

// evt-4: Diwali Pop-up Market — completed, everyone checked in
const evt4Attendees: Attendee[] = Array.from({ length: 15 }, (_, i) => makeAttendee(i, 'evt-4', 'Entry', 'checked_in'));

export const SAMPLE_ATTENDEES: Attendee[] = [...evt1Attendees, ...evt2Attendees, ...evt3Attendees, ...evt4Attendees];

export const getAttendeesForEvent = (eventId: string): Attendee[] =>
  SAMPLE_ATTENDEES.filter((a) => a.eventId === eventId);