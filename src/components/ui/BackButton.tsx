import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  className?: string;
  title?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ className = '', title = 'Go back' }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className={`p-2  rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs ${className}`}
      title={title}
    >
      <ArrowLeft size={18} />
    </button>
  );
};

export default BackButton;