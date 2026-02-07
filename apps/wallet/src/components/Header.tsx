import { useState, useRef, useEffect } from 'react';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '../stores/walletStore';
import { Link } from 'react-router-dom';

export default function Header() {
  const { connected, publicKey, lock, deleteWallet, exportSecretKey } = useSelfCustodyWallet();
  const { i18n } = useTranslation();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);
  const setPreferredCurrency = useWalletStore((s) => s.setPreferredCurrency);

  const [showMenu, setShowMenu] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportedKey, setExportedKey] = useState('');
  const [exportError, setExportError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  const toggleCurrency = () => {
    setPreferredCurrency(preferredCurrency === 'USD' ? 'VES' : 'USD');
  };

  const handleExport = async () => {
    setExportError('');
    try {
      const key = await exportSecretKey(exportPassword);
      setExportedKey(key);
    } catch {
      setExportError('Wrong password');
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(exportedKey);
  };

  const addr = publicKey?.toBase58() || '';
  const shortAddr = addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '';

  return (
    <>
      <header className="sticky top-0 z-50 bg-black border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-white">MVGA</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleCurrency}
              className="text-[10px] font-mono font-medium px-2 py-1 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition uppercase tracking-wider"
            >
              {preferredCurrency === 'USD' ? 'VES' : 'USD'}
            </button>
            <button
              onClick={toggleLang}
              className="text-[10px] font-mono font-medium px-2 py-1 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition uppercase tracking-wider"
            >
              {i18n.language === 'es' ? 'EN' : 'ES'}
            </button>

            {connected && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 border border-gold-500/30 text-gold-500 hover:bg-gold-500/10 transition text-xs font-mono"
                >
                  <span className="w-1.5 h-1.5 bg-green-400" />
                  {shortAddr}
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-[#111] border border-white/10 z-50">
                    <Link
                      to="/settings"
                      onClick={() => setShowMenu(false)}
                      className="block w-full text-left px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 transition uppercase tracking-wider"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowExport(true);
                      }}
                      className="block w-full text-left px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 transition uppercase tracking-wider"
                    >
                      Export Key
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        lock();
                      }}
                      className="block w-full text-left px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 transition uppercase tracking-wider border-t border-white/5"
                    >
                      Lock Wallet
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        deleteWallet();
                      }}
                      className="block w-full text-left px-4 py-2.5 text-xs font-mono text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition uppercase tracking-wider border-t border-white/5"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Export Key Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] px-6">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs tracking-[0.3em] text-white/30 uppercase font-mono">
                Export Secret Key
              </h3>
              <button
                onClick={() => {
                  setShowExport(false);
                  setExportPassword('');
                  setExportedKey('');
                  setExportError('');
                }}
                className="text-white/30 hover:text-white text-lg"
              >
                ×
              </button>
            </div>

            {!exportedKey ? (
              <>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExport()}
                  className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/20 focus:border-gold-500 outline-none font-mono text-sm"
                  autoFocus
                />
                {exportError && <p className="text-red-400 text-xs font-mono">{exportError}</p>}
                <button onClick={handleExport} className="w-full btn-primary">
                  Decrypt & Show
                </button>
              </>
            ) : (
              <>
                <p className="text-red-400/60 text-xs font-mono">
                  Never share this key. Anyone with it controls your funds.
                </p>
                <div className="bg-white/5 border border-gold-500/30 p-4 break-all font-mono text-xs text-white/70 leading-relaxed">
                  {exportedKey}
                </div>
                <button onClick={handleCopyKey} className="w-full btn-secondary">
                  Copy
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
