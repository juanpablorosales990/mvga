import { Routes, Route } from 'react-router-dom';
import { useMemo, lazy, Suspense } from 'react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';

// Self-custody wallet
import { SelfCustodyWalletProvider, useSelfCustodyWallet } from './contexts/WalletContext';
import OnboardingScreen from './components/OnboardingScreen';
import LockScreen from './components/LockScreen';

// Pages — WalletPage loaded eagerly (landing page), rest lazy-loaded
import WalletPage from './pages/WalletPage';
const SendPage = lazy(() => import('./pages/SendPage'));
const ReceivePage = lazy(() => import('./pages/ReceivePage'));
const SwapPage = lazy(() => import('./pages/SwapPage'));
const StakePage = lazy(() => import('./pages/StakePage'));
const P2PPage = lazy(() => import('./pages/P2PPage'));
const TradePage = lazy(() => import('./pages/TradePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const GrantsPage = lazy(() => import('./pages/GrantsPage'));
const GrantDetailPage = lazy(() => import('./pages/GrantDetailPage'));
const CreateProposalPage = lazy(() => import('./pages/CreateProposalPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const ChartsPage = lazy(() => import('./pages/ChartsPage'));
const TransparencyPage = lazy(() => import('./pages/TransparencyPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const BankingPage = lazy(() => import('./pages/BankingPage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
const CardPage = lazy(() => import('./pages/CardPage'));
const DepositPage = lazy(() => import('./pages/DepositPage'));
const ChargePage = lazy(() => import('./pages/ChargePage'));
const PayPage = lazy(() => import('./pages/PayPage'));
const TopUpPage = lazy(() => import('./pages/TopUpPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const PriceAlertsPage = lazy(() => import('./pages/PriceAlertsPage'));
const BatchSendPage = lazy(() => import('./pages/BatchSendPage'));
const ScheduledPaymentsPage = lazy(() => import('./pages/ScheduledPaymentsPage'));
const DCAPage = lazy(() => import('./pages/DCAPage'));
const PendingScheduledPage = lazy(() => import('./pages/PendingScheduledPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Components
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';

// Auth & Referral
import { useAuth } from './hooks/useAuth';
import { useReferral } from './hooks/useReferral';
import { usePriceAlerts } from './hooks/usePriceAlerts';

function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth(); // auto-authenticates on wallet unlock
  useReferral(); // captures ?ref= and auto-claims on connect
  usePriceAlerts(); // checks price alerts against live prices
  return <>{children}</>;
}

function AppShell() {
  const { walletState } = useSelfCustodyWallet();

  if (walletState === 'NO_WALLET') return <OnboardingScreen />;
  if (walletState === 'LOCKED') return <LockScreen />;

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Header />
        <ToastContainer />

        <main className="flex-1 pb-20 px-4 pt-4 max-w-lg mx-auto w-full">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[40vh]">
                  <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<WalletPage />} />
                <Route path="/send" element={<SendPage />} />
                <Route path="/receive" element={<ReceivePage />} />
                <Route path="/swap" element={<SwapPage />} />
                <Route path="/stake" element={<StakePage />} />
                <Route path="/p2p" element={<P2PPage />} />
                <Route path="/p2p/trade/:tradeId" element={<TradePage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/grants" element={<GrantsPage />} />
                <Route path="/grants/create" element={<CreateProposalPage />} />
                <Route path="/grants/:id" element={<GrantDetailPage />} />
                <Route path="/referral" element={<ReferralPage />} />
                <Route path="/charts" element={<ChartsPage />} />
                <Route path="/transparency" element={<TransparencyPage />} />
                <Route path="/metrics" element={<MetricsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/banking" element={<BankingPage />} />
                <Route path="/banking/savings" element={<SavingsPage />} />
                <Route path="/banking/card" element={<CardPage />} />
                <Route path="/deposit" element={<DepositPage />} />
                <Route path="/charge" element={<ChargePage />} />
                <Route path="/pay/:id" element={<PayPage />} />
                <Route path="/topup" element={<TopUpPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/price-alerts" element={<PriceAlertsPage />} />
                <Route path="/batch-send" element={<BatchSendPage />} />
                <Route path="/scheduled" element={<PendingScheduledPage />} />
                <Route path="/scheduled/payments" element={<ScheduledPaymentsPage />} />
                <Route path="/scheduled/dca" element={<DCAPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        <BottomNav />
      </div>
    </AuthProvider>
  );
}

function App() {
  // Solana RPC — custom URL via env var, fallback to public mainnet
  const endpoint = useMemo(
    () => import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SelfCustodyWalletProvider>
        <AppShell />
      </SelfCustodyWalletProvider>
    </ConnectionProvider>
  );
}

export default App;
