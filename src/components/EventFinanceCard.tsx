import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Scale } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useIncomes } from '../hooks/useIncomes';
import { useExpenses } from '../hooks/useExpenses';
import { IncomeModal } from './IncomeModal';
import { ExpenseModal } from './ExpenseModal';
import type { EventSummary } from '../types/event.types';

type DateLike = Date | string | number;

interface EventFinanceCardProps {
  companyId?: string;
  eventId?: string | null;
  eventName?: string | null;
  events: EventSummary[];
  eventsLoading?: boolean;
  isDataVisible: boolean;
  /** Same date-range filter the rest of the dashboard (Revenue, Ticket tiers, etc.) uses. */
  startDate?: DateLike;
  endDate?: DateLike;
}

const formatINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const toTimestamp = (d?: DateLike): number | null => {
  if (d === undefined || d === null) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
};

export const EventFinanceCard: React.FC<EventFinanceCardProps> = ({
  companyId,
  eventId,
  eventName,
  events,
  eventsLoading = false,
  isDataVisible,
  startDate,
  endDate,
}) => {
  const { incomes: allIncomes, loading: incomesLoading, addIncome } = useIncomes(companyId, eventId ?? undefined);
  const { expenses: allExpenses, loading: expensesLoading, addExpense } = useExpenses(companyId, eventId ?? undefined);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const loading = incomesLoading || expensesLoading;

  // Respect the same date-range filter the rest of the dashboard uses, so
  // this card lines up with what "last 30 days" (etc.) shows elsewhere.
  const startTs = toTimestamp(startDate);
  const endTs = toTimestamp(endDate);
  const inRange = (ts: number) => (startTs === null || ts >= startTs) && (endTs === null || ts <= endTs);

  const incomes = useMemo(() => allIncomes.filter((i) => inRange(i.date)), [allIncomes, startTs, endTs]);
  const expenses = useMemo(() => allExpenses.filter((e) => inRange(e.date)), [allExpenses, startTs, endTs]);

  const { totalIncome, totalExpense, net } = useMemo(() => {
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    return { totalIncome, totalExpense, net: totalIncome - totalExpense };
  }, [incomes, expenses]);

  const isPositive = net >= 0;

  return (
    <>
      <Card className="shadow-sm border-gray-200 dark:border-slate-800 dark:bg-[#1E293B]">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
              Income &amp; Expenses
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : !isDataVisible ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">Data hidden</div>
          ) : !eventId ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-slate-400">Select an event to see its finances</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-sm border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <ArrowUpCircle size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">Income</span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white truncate">
                  {formatINR(totalIncome)}
                </p>
                <p className="text-[11px] text-slate-400">{incomes.length} entr{incomes.length === 1 ? 'y' : 'ies'}</p>
              </div>

              <div className="rounded-sm border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <ArrowDownCircle size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">Expense</span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white truncate">
                  {formatINR(totalExpense)}
                </p>
                <p className="text-[11px] text-slate-400">{expenses.length} entr{expenses.length === 1 ? 'y' : 'ies'}</p>
              </div>

              <div
                className={`rounded-sm border p-3 ${
                  isPositive
                    ? 'border-[#007A78]/20 bg-[#007A78]/5 dark:border-[#2DD4BF]/20 dark:bg-[#2DD4BF]/5'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                }`}
              >
                <div className={`flex items-center gap-1.5 ${isPositive ? 'text-[#007A78] dark:text-[#2DD4BF]' : 'text-rose-600 dark:text-rose-400'}`}>
                  <Scale size={14} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">Net</span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white truncate">
                  {isPositive ? '+' : '-'}{formatINR(Math.abs(net))}
                </p>
                <p className="text-[11px] text-slate-400">{isPositive ? 'Profit so far' : 'Over budget'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <IncomeModal
        isOpen={incomeOpen}
        onClose={() => setIncomeOpen(false)}
        events={events}
        eventsLoading={eventsLoading}
        preselectedEventId={eventId ?? null}
        onSave={async (data) => {
          if (!companyId) return;
          await addIncome(companyId, data.eventId, {
            source: data.source,
            description: data.description,
            amount: data.amount,
            date: data.date,
            createdBy: data.createdBy,
          });
        }}
      />

      <ExpenseModal
        isOpen={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        events={events}
        eventsLoading={eventsLoading}
        preselectedEventId={eventId ?? null}
        onSave={async (data) => {
          if (!companyId) return;
          await addExpense(companyId, data.eventId, {
            title: data.title,
            description: data.description,
            amount: data.amount,
            date: data.date,
            createdBy: data.createdBy,
          });
        }}
      />
    </>
  );
};

export default EventFinanceCard;