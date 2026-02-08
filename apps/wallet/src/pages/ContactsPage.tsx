import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { showToast } from '../hooks/useToast';

export default function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addressBook = useWalletStore((s) => s.addressBook);
  const addAddress = useWalletStore((s) => s.addAddress);
  const removeAddress = useWalletStore((s) => s.removeAddress);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const filtered = addressBook.filter(
    (c) =>
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!newLabel.trim()) {
      setError(t('contacts.nameRequired'));
      return;
    }
    try {
      new PublicKey(newAddress);
    } catch {
      setError(t('contacts.invalidAddress'));
      return;
    }
    addAddress({ label: newLabel.trim(), address: newAddress });
    setNewLabel('');
    setNewAddress('');
    setShowAdd(false);
    setError('');
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    showToast('success', t('contacts.copied'));
  };

  const handleDelete = (address: string) => {
    if (window.confirm(t('contacts.confirmDelete'))) {
      removeAddress(address);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t('contacts.title')}</h1>
          <p className="text-sm text-gray-400">{t('contacts.subtitle')}</p>
        </div>
      </div>

      {/* Search */}
      {addressBook.length > 2 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('contacts.searchPlaceholder')}
          className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
        />
      )}

      {/* Add Contact Form */}
      {showAdd ? (
        <div className="card p-4 space-y-3">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('contacts.namePlaceholder')}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold-500"
          />
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder={t('contacts.addressPlaceholder')}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 font-mono text-sm focus:outline-none focus:border-gold-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setError('');
              }}
              className="flex-1 py-2.5 bg-white/10 text-gray-300 text-sm"
            >
              {t('common.cancel')}
            </button>
            <button onClick={handleAdd} className="flex-1 btn-primary text-sm">
              {t('contacts.save')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border border-dashed border-white/20 text-gray-400 text-sm hover:bg-white/5 transition"
        >
          + {t('contacts.addContact')}
        </button>
      )}

      {/* Contact List */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">{t('contacts.empty')}</p>
      ) : (
        <div className="space-y-2">
          {filtered
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((contact) => (
              <div key={contact.address} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{contact.label}</p>
                    <button
                      onClick={() => handleCopy(contact.address)}
                      className="font-mono text-xs text-gray-500 hover:text-gray-300 transition truncate block max-w-full"
                    >
                      {contact.address.slice(0, 12)}...{contact.address.slice(-8)}
                    </button>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/send?to=${contact.address}`)}
                      className="text-xs px-3 py-1.5 bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition"
                    >
                      {t('contacts.send')}
                    </button>
                    <button
                      onClick={() => handleDelete(contact.address)}
                      className="text-xs px-2 py-1.5 text-red-400 hover:bg-red-500/10 transition"
                    >
                      {t('contacts.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
