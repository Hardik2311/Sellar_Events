import React from 'react';

interface StatBoxProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  isVisible?: boolean;
  loading?: boolean;
}

/**
 * Small labeled stat tile — used inside cards for things like
 * "Tickets sold", "Revenue", "Checked in". Mirrors the tile style
 * used in CompletedSalesCard in the catalogue app.
 */
export const StatBox: React.FC<StatBoxProps> = ({ label, value, icon, isVisible = true, loading = false }) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-gray-100 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-400">{icon}</span>}
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      {loading ? (
        <div className="h-5 w-16 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="text-lg font-semibold text-slate-800">{isVisible ? value : '••••'}</p>
      )}
    </div>
  );
};

export default StatBox;