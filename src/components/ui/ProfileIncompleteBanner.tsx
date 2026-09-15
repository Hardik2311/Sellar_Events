import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const ProfileIncompleteBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const navigate = useNavigate();

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-b border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 ${className}`}
    >
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <AlertTriangle size={16} className="shrink-0" />
        <p className="text-xs font-semibold">
          Complete your profile (PAN &amp; Aadhaar) to create and publish events.
        </p>
      </div>
      <button
        onClick={() => navigate('/events/account/edit')}
        className="shrink-0 rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 sm:ml-auto"
      >
        Complete profile
      </button>
    </div>
  );
};

export default ProfileIncompleteBanner;
