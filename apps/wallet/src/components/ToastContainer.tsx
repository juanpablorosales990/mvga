import { useToast, dismissToast, type Toast } from '../hooks/useToast';

const ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<Toast['type'], string> = {
  success: 'bg-green-500/20 border-green-500/40 text-green-400',
  error: 'bg-red-500/20 border-red-500/40 text-red-400',
  warning: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  info: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
};

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`pointer-events-auto border px-4 py-3 flex items-start gap-3 shadow-lg animate-slide-in ${COLORS[toast.type]}`}
        >
          <span className="text-lg leading-none mt-0.5">{ICONS[toast.type]}</span>
          <p className="flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-white/40 hover:text-white/70 text-sm leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
