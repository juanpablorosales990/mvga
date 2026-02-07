import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  message: string;
  variant?: 'default' | 'danger';
  requireInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  confirmLabel?: string;
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'default',
  requireInput = false,
  inputLabel,
  inputPlaceholder,
  confirmLabel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (requireInput && !inputValue.trim()) return;
    onConfirm(requireInput ? inputValue.trim() : undefined);
    setInputValue('');
  };

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-[#141414] border border-white/10 p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>

        {requireInput && (
          <div>
            {inputLabel && <label className="block text-sm text-gray-400 mb-1">{inputLabel}</label>}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              rows={3}
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-gold-500 resize-none"
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20 transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={requireInput && !inputValue.trim()}
            className={`flex-1 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${
              isDanger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gold-500 text-black hover:bg-gold-600'
            }`}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
