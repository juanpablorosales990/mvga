import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';

interface AddressBookModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (address: string) => void;
}

export default function AddressBookModal({ open, onClose, onSelect }: AddressBookModalProps) {
  const { t } = useTranslation();
  const addressBook = useWalletStore((s) => s.addressBook);
  const addAddress = useWalletStore((s) => s.addAddress);
  const removeAddress = useWalletStore((s) => s.removeAddress);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleAdd = () => {
    if (!newLabel.trim()) {
      setError(t('addressBook.labelRequired'));
      return;
    }

    try {
      new PublicKey(newAddress);
    } catch {
      setError(t('addressBook.invalidAddress'));
      return;
    }

    addAddress({ label: newLabel.trim(), address: newAddress });
    setNewLabel('');
    setNewAddress('');
    setShowAdd(false);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
      <div className="bg-[#1a1a1a] rounded-t-3xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('addressBook.title')}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">
            ×
          </button>
        </div>

        {/* Add new */}
        {showAdd ? (
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t('addressBook.labelPlaceholder')}
              className="w-full bg-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500"
            />
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder={t('addressBook.addressPlaceholder')}
              className="w-full bg-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-primary-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setError('');
                }}
                className="flex-1 py-2 rounded-xl bg-white/10 text-gray-300"
              >
                {t('common.cancel')}
              </button>
              <button onClick={handleAdd} className="flex-1 btn-primary text-sm">
                {t('addressBook.save')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full mb-4 py-3 rounded-xl border border-dashed border-white/20 text-gray-400 text-sm hover:bg-white/5 transition"
          >
            + {t('addressBook.addNew')}
          </button>
        )}

        {/* Address list */}
        {addressBook.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">{t('addressBook.empty')}</p>
        ) : (
          <div className="space-y-2">
            {addressBook.map((entry) => (
              <div key={entry.address} className="card flex items-center justify-between">
                <button
                  onClick={() => {
                    onSelect(entry.address);
                    onClose();
                  }}
                  className="flex-1 text-left"
                >
                  <p className="font-medium text-sm">{entry.label}</p>
                  <p className="font-mono text-xs text-gray-500">
                    {entry.address.slice(0, 8)}...{entry.address.slice(-8)}
                  </p>
                </button>
                <button
                  onClick={() => removeAddress(entry.address)}
                  className="text-red-400 text-sm px-2 py-1 hover:bg-red-500/10 rounded"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
