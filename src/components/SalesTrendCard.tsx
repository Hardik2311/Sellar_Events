import React from 'react';
import type { SalesTrendPoint } from '../types/event.types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface SalesTrendCardProps {
  data: SalesTrendPoint[];
  isDataVisible: boolean;
  loading?: boolean;
}

/**
 * Lightweight bar chart built with plain divs — keeps this dependency-free
 * for now. Card chrome (header/title sizing) matches the other catalogue
 * cards; swap the bars for a real chart lib later without touching props.
 */
export const SalesTrendCard: React.FC<SalesTrendCardProps> = ({ data, isDataVisible, loading = false }) => {
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Revenue — last 7 days</CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="h-32 animate-pulse rounded bg-gray-100" />
        ) : !isDataVisible ? (
          <div className="text-center py-8 text-gray-400 text-sm">Data hidden</div>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {data.map((point) => {
              const heightPercent = Math.max(4, Math.round((point.revenue / max) * 100));
              return (
                <div key={point.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <div
                    className="w-full rounded-t-sm bg-orange-100 hover:bg-[#F97316] transition-colors"
                    style={{ height: `${heightPercent}%` }}
                    title={`₹${point.revenue.toLocaleString('en-IN')}`}
                  />
                  <span className="text-[10px] text-gray-500">
                    {new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesTrendCard;