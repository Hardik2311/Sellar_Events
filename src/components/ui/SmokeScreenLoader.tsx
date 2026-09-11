import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import FloatingEventIcons from './FloatingEventIcons';

interface SmokeScreenLoaderProps {
  isVisible: boolean;
  messages?: string[];
  intervalMs?: number;
}

const defaultMessages = [
  'Creating your account...',
  'Setting up your organization...',
  'Configuring your workspace...',
  'Preparing your event dashboard...',
  'Syncing your preferences...',
  'Personalizing your experience...',
  'Loading your tools...',
  'Almost there...',
  'Just a few more seconds...',
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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#0B4F4D] via-[#073D3B] to-[#03211F]">
      {/* dot grid pattern — same texture as the hero panel */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      {/* soft glow accents — same as hero panel */}
      <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-[#2DD4BF]/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl" />

      <FloatingEventIcons iconClassName="text-white" />

      <div className="relative z-20 flex flex-col items-center">
        <img
          src="/Outsold.png"
          alt="Outsold"
          className="h-23 w-auto mb-4"
        />
        <Loader2 className="animate-spin text-white" size={48} />
        <p className="mt-4 text-base font-semibold text-white text-center px-6">
          {messages[messageIndex]}
        </p>
      </div>
    </div>
  );
};

export default SmokeScreenLoader;