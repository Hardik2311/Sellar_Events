import React from 'react';
import { Scan, AlertCircle } from 'lucide-react';
import { useQrScanner } from '../hooks/useQrScanner'

// Embedded scan surface for the Check-in page (as opposed to QRScanner,
// which is a modal). Same underlying camera/decode hook — just different
// chrome: a tap-to-start box that fills its container instead of a popup.

interface CheckInScannerProps {
  active: boolean;
  onScan: (decodedText: string) => void;
  onActivate: () => void;
}

const CheckInScanner: React.FC<CheckInScannerProps> = ({ active, onScan, onActivate }) => {
  const { videoRef, canvasRef, error, scanning } = useQrScanner({ active, onDetected: onScan });

  return (
    <button
      type="button"
      onClick={() => {
        if (!active) onActivate();
      }}
      className="relative w-full aspect-square rounded-2xl bg-neutral-800 overflow-hidden flex items-center justify-center"
    >
      {error ? (
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-xs text-neutral-300">{error}</p>
        </div>
      ) : active ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/50" />
          </div>
          {scanning && (
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
              Point the camera at the ticket QR code
            </p>
          )}
        </>
      ) : (
        <Scan size={56} className="text-neutral-400" strokeWidth={1.5} />
      )}
    </button>
  );
};

export default CheckInScanner;