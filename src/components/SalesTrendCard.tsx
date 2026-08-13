import React from 'react';
import type { SalesTrendPoint } from '../types/event.types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface SalesTrendCardProps {
  data: SalesTrendPoint[];
  isDataVisible: boolean;
  loading?: boolean;
}

export const SalesTrendCard: React.FC<SalesTrendCardProps> = ({ data, isDataVisible, loading = false }) => {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const labelStep = data.length > 14 ? Math.ceil(data.length / 10) : 1;

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          Revenue — last {data.length} days
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="h-32 animate-pulse rounded bg-gray-100" />
        ) : !isDataVisible ? (
          <div className="text-center py-8 text-gray-400 text-sm">Data hidden</div>
        ) : (
          <div className="flex items-end gap-2 h-32 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] dark:[scrollbar-color:#475569_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-sm">
            {data.map((point, i) => {
              const heightPercent = Math.max(4, Math.round((point.revenue / max) * 100));
              const showLabel = i % labelStep === 0;
              return (
                <div
                  key={point.date}
                  className="shrink-0 flex flex-col items-center justify-end h-full gap-1"
                  style={{ width: data.length > 14 ? '32px' : `${100 / data.length}%` }}
                >
                  <div
                    className="w-full rounded-t-sm bg-[#007A78]/20 hover:bg-[#007A78] dark:bg-[#2DD4BF]/30 dark:hover:bg-[#2DD4BF] transition-all"
                    style={{ height: `${heightPercent}%` }}
                    title={`₹${point.revenue.toLocaleString('en-IN')}`}
                  />
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {showLabel
                      ? new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '\u00A0'}
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