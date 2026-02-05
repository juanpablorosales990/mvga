import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock wallet adapter to prevent Solana dependency issues
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    publicKey: null,
    connecting: false,
    disconnect: vi.fn(),
    connect: vi.fn(),
    wallet: null,
    wallets: [],
  }),
  useConnection: () => ({ connection: {} }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ authToken: null }),
}));

import BottomNav from '../components/BottomNav';
import MorePage from '../pages/MorePage';

describe('BottomNav', () => {
  it('renders all navigation items', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    expect(screen.getByText('Wallet')).toBeTruthy();
    expect(screen.getByText('Swap')).toBeTruthy();
    expect(screen.getByText('Stake')).toBeTruthy();
    expect(screen.getByText('P2P')).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
  });

  it('renders exactly 5 nav links', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    const links = container.querySelectorAll('a');
    expect(links.length).toBe(5);
  });

  it('links to correct paths', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/swap');
    expect(hrefs).toContain('/stake');
    expect(hrefs).toContain('/p2p');
    expect(hrefs).toContain('/more');
  });
});

describe('MorePage', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>
    );

    expect(screen.getByText('More')).toBeTruthy();
  });

  it('renders all menu items', () => {
    render(
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Send')).toBeTruthy();
    expect(screen.getByText('Receive')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText('Grants')).toBeTruthy();
  });

  it('links to correct paths', () => {
    const { container } = render(
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>
    );

    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/send');
    expect(hrefs).toContain('/receive');
    expect(hrefs).toContain('/history');
    expect(hrefs).toContain('/grants');
  });
});
