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
  const lastIndex = data.length - 1;
  const pointGap = 32;
  const chartWidth = Math.max(data.length - 1, 1) * pointGap;

  const points = data.map((point, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2;
    const y = 100 - Math.max(0, Math.min(100, (point.revenue / max) * 100));
    return { x, y, point };
  });

  return (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-900">
          Revenue — last {data.length} days
        </CardTitle>
        {!loading && isDataVisible && data.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[#007A78]/10 dark:bg-[#2DD4BF]/15 px-2 py-1 text-[10px] font-black uppercase text-[#007A78] dark:text-[#2DD4BF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF] animate-pulse" /> Live
          </span>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="h-32 animate-pulse rounded bg-gray-100" />
        ) : !isDataVisible ? (
          <div className="text-center py-8 text-gray-400 text-sm">Data hidden</div>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] dark:[scrollbar-color:#475569_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-sm">
            <div style={{ width: data.length > 3 ? `${chartWidth}px` : '100%', minWidth: '100%' }}>
              <svg
                viewBox={`0 0 ${chartWidth} 100`}
                preserveAspectRatio="none"
                className="w-full h-28 overflow-visible text-[#007A78] dark:text-[#2DD4BF]"
              >
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {points.map(({ x, y, point }, i) => (
                  <circle key={point.date} cx={x} cy={y} r={i === lastIndex ? 3.5 : 2} fill="currentColor" vectorEffect="non-scaling-stroke">
                    <title>₹{point.revenue.toLocaleString('en-IN')}</title>
                  </circle>
                ))}
              </svg>

              <div className="flex mt-1">
                {data.map((point, i) => {
                  const showLabel = i % labelStep === 0;
                  return (
                    <span key={point.date} className="text-[10px] text-gray-500 whitespace-nowrap text-center" style={{ width: `${100 / data.length}%` }}>
                      {showLabel ? new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '\u00A0'}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesTrendCard;