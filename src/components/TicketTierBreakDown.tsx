import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { TicketTier } from '../types/event.types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface TicketTierBreakdownProps {
  tiers: TicketTier[];
  isDataVisible: boolean;
  loading?: boolean;
}

const SOLD_COLOR = '#007A78';
const REMAINING_COLOR = '#E2E8F0';
const ROW_HEIGHT = 56;

export const TicketTierBreakdown: React.FC<TicketTierBreakdownProps> = ({
  tiers,
  isDataVisible,
  loading = false,
}) => {
  const chartData = tiers.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    sold: t.sold,
    total: t.total,
    remaining: Math.max(0, t.total - t.sold),
    percent: t.total > 0 ? Math.min(100, Math.round((t.sold / t.total) * 100)) : 0,
  }));

  const TierTick = ({ x, y, payload }: any) => {
    const tier = chartData.find((d) => d.name === payload.value);
    return (
      <text x={x} y={y} textAnchor="end">
        <tspan x={x - 8} dy="-4" fontSize={15} fontWeight={600} fill="#1e293b">
          {payload.value}
        </tspan>
        <tspan x={x - 8} dy="18" fontSize={12} fill="#94a3b8">
          ₹{tier?.price} per ticket
        </tspan>
      </text>
    );
  };

  const EndLabel = ({ x, y, width, height, index }: any) => {
    const d = chartData[index];
    if (!d) return null;
    return (
      <g>
        <text x={x + width + 12} y={y + height / 2 - 8} dominantBaseline="middle" fontSize={15} fontWeight={700} fill="#0f172a">
          {d.sold}/{d.total}
        </text>
        <text x={x + width + 12} y={y + height / 2 + 10} dominantBaseline="middle" fontSize={12} fontWeight={700} fill={SOLD_COLOR}>
          {d.percent}%
        </text>
      </g>
    );
  };

  return (
    <Card className="h-full flex flex-col shadow-sm border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Ticket tiers</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : tiers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No ticket tiers set up yet</p>
          </div>
        ) : !isDataVisible ? (
          <div className="text-center py-8 text-gray-400 text-sm">Data hidden</div>
        ) : (
          <div style={{ width: '100%', height: Math.max(chartData.length * ROW_HEIGHT, 200) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 70, bottom: 8, left: 8 }}
                barSize={26}
                barCategoryGap="15%"
              >
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  axisLine={false}
                  tickLine={false}
                  tick={<TierTick />}
                />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="sold" name="Sold" stackId="a" fill={SOLD_COLOR} radius={[6, 0, 0, 6]} />
                <Bar
                  dataKey="remaining"
                  name="Remaining"
                  stackId="a"
                  fill={REMAINING_COLOR}
                  radius={[0, 6, 6, 0]}
                  label={<EndLabel />}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TicketTierBreakdown;