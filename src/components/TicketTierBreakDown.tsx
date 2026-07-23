import React from 'react';
import type { TicketTier } from '../types/event.types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface TicketTierBreakdownProps {
  tiers: TicketTier[];
  isDataVisible: boolean;
  loading?: boolean;
}

/**
 * Mirrors TopSoldItemsCard/TopFiveOrder's list style: numbered circle
 * badge, name on the left, value right-aligned. Adds a slim progress
 * bar underneath since sold-vs-total is unique to ticket tiers.
 */
export const TicketTierBreakdown: React.FC<TicketTierBreakdownProps> = ({ tiers, isDataVisible, loading = false }) => {
  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Ticket tiers</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          [1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)
        ) : tiers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No ticket tiers set up yet</p>
          </div>
        ) : !isDataVisible ? (
          <div className="text-center py-8 text-gray-400 text-sm">Data hidden</div>
        ) : (
          tiers.map((tier, index) => {
            const percent = tier.total > 0 ? Math.min(100, Math.round((tier.sold / tier.total) * 100)) : 0;
            return (
              <div key={tier.id}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 h-6 w-6 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{tier.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap shrink-0">
                    ₹{tier.price} · {tier.sold}/{tier.total}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 w-6" aria-hidden="true" />
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#F97316] transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>  
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default TicketTierBreakdown;