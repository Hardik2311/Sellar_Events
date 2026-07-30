import React from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';
import { useQrScanner } from '../hooks/useQrScanner'

// Reusable QR scanner modal. Drop this anywhere you need a "scan to
// find/act on X" flow — it only emits the decoded string via onScan, it
// doesn't know what that string means. The caller decides what to do with
// it (look up a ticket, an order id, whatever). Camera/decode logic lives
// in useQrScanner so this file is just the modal chrome.

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  // Optional: shown in the header, e.g. "Scan ticket QR to check in"
  title?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan, title = 'Scan QR code' }) => {
  const { videoRef, canvasRef, error, scanning } = useQrScanner({ active: isOpen, onDetected: onScan });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-[#007A78] dark:text-[#2DD4BF]" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="relative bg-black aspect-square">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm text-white">{error}</p>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {/* Viewfinder frame overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-2/3 w-2/3 rounded-2xl border-2 border-[#007A78] dark:border-[#2DD4BF]" />
              </div>
              {scanning && (
                <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
                  Point the camera at the ticket QR code
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;