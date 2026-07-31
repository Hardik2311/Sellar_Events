import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { EventDashboardData, EventSummary, EventStatus, TicketTier, SalesTrendPoint } from '../types/event.types';

export const CACHE_DURATION = 60 * 60 * 1000;
export type WithCacheMeta<T> = T & {
    lastUpdated: number;
    cacheStart: string;
    cacheEnd: string;
};

const CONFIRMED_STATUSES = new Set(['valid', 'checked_in']);

interface FetchEventDashboardOptions {
    companyId: string;
    startDate: string;
    endDate: string;
    cacheKey: string;
    forceRefresh?: boolean;
}

export async function fetchEventDashboardData(
    options: FetchEventDashboardOptions
): Promise<WithCacheMeta<EventDashboardData>> {
    const { companyId, startDate, endDate, cacheKey, forceRefresh = false } = options;

    // 1. Cache check — identical pattern to fetchDashboardData
    if (!forceRefresh) {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed: WithCacheMeta<EventDashboardData> = JSON.parse(cached);
                const timeOk = Date.now() - parsed.lastUpdated < CACHE_DURATION;
                const dateOk = parsed.cacheStart === startDate && parsed.cacheEnd === endDate;
                if (timeOk && dateOk) return parsed;
            }
        } catch {
            localStorage.removeItem(cacheKey);
        }
    }

    // 2. Fetch events in the selected date range
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    // Events are NOT date-filtered anymore — always fetch all of them.
    // The selected date range only scopes ticketsSold/revenue/tier stats below.
    const eventsSnap = await getDocs(query(
        collection(db, 'companies', companyId, 'events'),
        orderBy('startDate', 'asc')
    ));

    // 3. Aggregate each event's attendees subcollection.
    //    N+1 reads — fine for a handful of events; if the event count grows,
    //    consider denormalizing ticketsSold/revenue onto the event doc via a
    //    Cloud Function trigger on attendee writes instead.
    const salesByDate: Record<string, number> = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        salesByDate[d.toLocaleDateString('en-CA')] = 0;
    }

    const events: EventSummary[] = await Promise.all(
        eventsSnap.docs.map(async (eventDoc) => {
            const e = eventDoc.data();
            const attendeesSnap = await getDocs(
                collection(db, 'companies', companyId, 'events', eventDoc.id, 'attendees')
            );

            let ticketsSold = 0;
            let revenue = 0;
            const tierSold: Record<string, number> = {};

            const tierByName = new Map((e.tiers || []).map((t: any) => [t.name, t]));

            attendeesSnap.forEach((a) => {
                const att = a.data();
                if (!CONFIRMED_STATUSES.has(att.status)) return;

                // purchasedAt is the source of truth going forward; tickets created
                // before this field existed fall back to createdAt.
                const purchasedAt: Timestamp | undefined = att.purchasedAt ?? att.createdAt;
                if (!purchasedAt) return;

                const purchaseDate = purchasedAt.toDate();
                if (purchaseDate < start || purchaseDate > end) return;

                ticketsSold += 1;

                // Older tickets don't have ticketTierId/amountPaid stored — recover the
                // tier by name and approximate revenue using the tier's current price.
                const matchedTier = att.ticketTierId ? null : tierByName.get(att.tierName);
                const resolvedTierId = att.ticketTierId || matchedTier?.id;
                const resolvedAmount = att.amountPaid ?? matchedTier?.price ?? 0;

                revenue += Number(resolvedAmount) || 0;
                if (resolvedTierId) {
                    tierSold[resolvedTierId] = (tierSold[resolvedTierId] || 0) + 1;
                }

                const dateKey = purchaseDate.toLocaleDateString('en-CA');
                if (dateKey in salesByDate) salesByDate[dateKey] += Number(resolvedAmount) || 0;
            });

            const tiers: TicketTier[] = (e.tiers || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                price: t.price,
                total: t.quantity,
                sold: tierSold[t.id] || 0,
            }));

            return {
                id: eventDoc.id,
                title: e.title,
                category: e.category,
                status: e.status as EventStatus,
                startDate: (e.startDate as Timestamp).toDate().toISOString(),
                venue: e.venue,
                description: e.description,
                accentColor: e.accentColor,
                coverImage: e.coverImageUrl,
                ticketsSold,
                ticketsTotal: tiers.reduce((sum, t) => sum + t.total, 0),
                revenue,
                tiers,
            };
        })
    );

    const salesTrend: SalesTrendPoint[] = Object.entries(salesByDate).map(([date, revenue]) => ({ date, revenue }));

    const result: WithCacheMeta<EventDashboardData> = {
        events,
        salesTrend,
        lastUpdated: Date.now(),
        cacheStart: startDate,
        cacheEnd: endDate,
    };

    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
}