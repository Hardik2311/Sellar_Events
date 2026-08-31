import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SmokeScreenLoaderProps {
  isVisible: boolean;
  messages?: string[];
  intervalMs?: number;
}

const defaultMessages = [
  'Creating your account...',
  'Setting up your organization...',
  'Preparing your event dashboard...',
  'Almost there...',
];

const SmokeScreenLoader: React.FC<SmokeScreenLoaderProps> = ({
  isVisible,
  messages = defaultMessages,
  intervalMs = 1400,
}) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setMessageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isVisible, messages, intervalMs]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-slate-900">
      <Loader2 className="animate-spin text-[#007A78] dark:text-[#2DD4BF]" size={48} />
      <p className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-200">
        {messages[messageIndex]}
      </p>
    </div>
  );
};

export default SmokeScreenLoader;