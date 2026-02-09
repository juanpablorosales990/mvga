import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startScanner } from '../utils/qr-scanner';

interface QRScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScannerModal({ open, onClose, onScan }: QRScannerModalProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) return;

    let cleanup: (() => void) | undefined;

    // Small delay to ensure modal is rendered
    const timer = setTimeout(() => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('send.cameraPermissionDenied'));
        return;
      }

      cleanup = startScanner(videoEl, canvasEl, (data) => {
        onScan(data);
        onClose();
      });

      // Detect permission denial after a timeout
      const permTimer = setTimeout(() => {
        if (videoEl.readyState < videoEl.HAVE_ENOUGH_DATA) {
          setError(t('send.cameraPermissionDenied'));
        }
      }, 5000);

      const origCleanup = cleanup;
      cleanup = () => {
        clearTimeout(permTimer);
        origCleanup();
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [open, onScan, onClose, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold">{t('send.scannerTitle')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan frame overlay */}
        <div className="relative z-10 w-64 h-64 border-2 border-white/40 rounded-2xl">
          <div className="absolute -top-px -left-px w-8 h-8 border-t-2 border-l-2 border-gold-500 rounded-tl-2xl" />
          <div className="absolute -top-px -right-px w-8 h-8 border-t-2 border-r-2 border-gold-500 rounded-tr-2xl" />
          <div className="absolute -bottom-px -left-px w-8 h-8 border-b-2 border-l-2 border-gold-500 rounded-bl-2xl" />
          <div className="absolute -bottom-px -right-px w-8 h-8 border-b-2 border-r-2 border-gold-500 rounded-br-2xl" />
        </div>

        {error && (
          <div className="absolute bottom-8 left-4 right-4 bg-red-500/20 border border-red-500/40 p-4 rounded-lg text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="text-center text-gray-500 text-sm pb-8">{t('pay.scanQr')}</p>
    </div>
  );
}
