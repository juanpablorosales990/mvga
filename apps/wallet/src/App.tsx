import { Routes, Route, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Pages
import WalletPage from './pages/WalletPage';
import SendPage from './pages/SendPage';
import ReceivePage from './pages/ReceivePage';
import SwapPage from './pages/SwapPage';
import StakePage from './pages/StakePage';
import P2PPage from './pages/P2PPage';

// Components
import BottomNav from './components/BottomNav';
import Header from './components/Header';

// Auth
import { useAuth } from './hooks/useAuth';

function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth(); // auto-authenticates on wallet connect
  return <>{children}</>;
}

function App() {
  // Solana network - use devnet for testing, mainnet-beta for production
  const network = 'mainnet-beta';
  const endpoint = useMemo(() => clusterApiUrl(network), []);

  // Supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AuthProvider>
          <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
            <Header />

            <main className="flex-1 pb-20 px-4 pt-4 max-w-lg mx-auto w-full">
              <Routes>
                <Route path="/" element={<WalletPage />} />
                <Route path="/send" element={<SendPage />} />
                <Route path="/receive" element={<ReceivePage />} />
                <Route path="/swap" element={<SwapPage />} />
                <Route path="/stake" element={<StakePage />} />
                <Route path="/p2p" element={<P2PPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            <BottomNav />
          </div>
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
