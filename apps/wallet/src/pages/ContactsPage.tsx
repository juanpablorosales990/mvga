import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

interface ServerContact {
  id: string;
  contactAddress: string;
  label: string;
  isFavorite: boolean;
  displayName: string | null;
  username: string | null;
  citizenNumber: number | null;
}

export default function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const addressBook = useWalletStore((s) => s.addressBook);
  const addAddress = useWalletStore((s) => s.addAddress);
  const removeAddress = useWalletStore((s) => s.removeAddress);

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [serverProfiles, setServerProfiles] = useState<Map<string, ServerContact>>(new Map());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Sync contacts with server when authenticated
  const syncWithServer = useCallback(async () => {
    if (!isAuthenticated) return;
    setSyncing(true);
    try {
      // Push local contacts to server
      await apiFetch('/social/contacts', {
        method: 'POST',
        body: JSON.stringify({
          contacts: addressBook.map((c) => ({
            label: c.label,
            address: c.address,
            isFavorite: favorites.has(c.address),
          })),
        }),
      });

      // Fetch server contacts (with resolved profiles)
      const serverContacts = await apiFetch<ServerContact[]>('/social/contacts');
      const profileMap = new Map<string, ServerContact>();
      const favSet = new Set<string>();
      for (const sc of serverContacts) {
        profileMap.set(sc.contactAddress, sc);
        if (sc.isFavorite) favSet.add(sc.contactAddress);
      }
      setServerProfiles(profileMap);
      setFavorites(favSet);
      track(AnalyticsEvents.CONTACTS_SYNCED, { count: addressBook.length });
    } catch {
      // Silent fail — local contacts still work
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, addressBook, favorites]);

  // Sync on mount + when auth changes
  useEffect(() => {
    syncWithServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const filtered = addressBook.filter(
    (c) =>
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      serverProfiles.get(c.address)?.username?.toLowerCase().includes(search.toLowerCase()) ||
      serverProfiles.get(c.address)?.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: favorites first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    const aFav = favorites.has(a.address) ? 0 : 1;
    const bFav = favorites.has(b.address) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.label.localeCompare(b.label);
  });

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
      // Also remove from server
      if (isAuthenticated) {
        apiFetch(`/social/contacts/${encodeURIComponent(address)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    }
  };

  const toggleFavorite = (address: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
    // Sync to server in background
    if (isAuthenticated) {
      syncWithServer();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/more" className="text-gray-400 hover:text-white" aria-label={t('common.back')}>
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
          <p className="text-sm text-gray-400">
            {syncing ? t('contacts.syncing') : t('contacts.subtitle')}
          </p>
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
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3 opacity-30">&#x1F465;</div>
          <p className="text-sm mb-4">{t('contacts.empty')}</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm font-medium text-gold-500 hover:text-gold-400 transition"
          >
            + {t('contacts.addContact')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((contact) => {
            const profile = serverProfiles.get(contact.address);
            const isFav = favorites.has(contact.address);

            return (
              <div key={contact.address} className="card p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-gold-400 flex-shrink-0">
                    {(profile?.displayName || contact.label)[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate" title={contact.label}>
                        {contact.label}
                      </p>
                      {profile?.username && (
                        <span className="text-[10px] text-gold-400">@{profile.username}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopy(contact.address)}
                      title={contact.address}
                      aria-label={t('common.copy')}
                      className="font-mono text-xs text-gray-500 hover:text-gray-300 transition truncate block max-w-full"
                    >
                      {contact.address.slice(0, 12)}...{contact.address.slice(-8)}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => toggleFavorite(contact.address)}
                      className={`text-xs px-2 py-1.5 transition ${
                        isFav
                          ? 'text-gold-400 hover:text-gold-300'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      title={isFav ? t('contacts.unfavorite') : t('contacts.favorite')}
                    >
                      {isFav ? '\u2605' : '\u2606'}
                    </button>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
