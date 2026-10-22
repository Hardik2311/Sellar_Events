// One QR "pass" per holder: a group booking (same name, same order) collapses
// into a single pass whose QR is the lead ticket's ID and admits everyone.
// Used by the ticket confirmation screen and Super Admin → Send Tickets.

interface PassableTicket {
  ticketId: string;
  tierName: string;
  amountPaid?: number;
  bookingGroupId?: string | null;
}

export type TicketPass<T extends PassableTicket> = T & {
  admits: number;
  memberIds: string[];
  members: T[];
};

export const toPasses = <T extends PassableTicket>(tickets: T[]): TicketPass<T>[] => {
  const groups = new Map<string, T[]>();
  tickets.forEach((t) => {
    const key = t.bookingGroupId || t.ticketId;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  });
  return Array.from(groups.values()).map((members) => {
    const lead = members[0];
    if (members.length === 1) return { ...lead, admits: 1, memberIds: [lead.ticketId], members };
    const tierCounts = new Map<string, number>();
    members.forEach((m) => tierCounts.set(m.tierName, (tierCounts.get(m.tierName) ?? 0) + 1));
    return {
      ...lead,
      tierName: Array.from(tierCounts.entries()).map(([name, n]) => `${name} × ${n}`).join(' + '),
      amountPaid: members.reduce((sum, m) => sum + (m.amountPaid ?? 0), 0),
      admits: members.length,
      memberIds: members.map((m) => m.ticketId),
      members,
    };
  });
};
