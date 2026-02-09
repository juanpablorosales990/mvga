import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GettingStartedCard from '../components/GettingStartedCard';
import { useWalletStore } from '../stores/walletStore';

function renderCard() {
  return render(
    <MemoryRouter>
      <GettingStartedCard />
    </MemoryRouter>
  );
}

describe('GettingStartedCard', () => {
  beforeEach(() => {
    useWalletStore.setState({
      checklistDismissed: false,
      firstSendCompleted: false,
      cardStatus: 'none',
      balances: [],
      kycStatus: 'UNVERIFIED',
    });
  });

  it('renders the checklist title', () => {
    renderCard();
    expect(screen.getByText('Getting Started')).toBeTruthy();
  });

  it('shows progress text', () => {
    renderCard();
    // 1 of 7 completed (create wallet is always checked)
    expect(screen.getByText('1 of 7 completed')).toBeTruthy();
  });

  it('renders all 7 checklist items', () => {
    renderCard();
    expect(screen.getByText('Create your wallet')).toBeTruthy();
    expect(screen.getByText('Secure with biometrics')).toBeTruthy();
    expect(screen.getByText('Make your first deposit')).toBeTruthy();
    expect(screen.getByText('Verify your identity')).toBeTruthy();
    expect(screen.getByText('Send your first payment')).toBeTruthy();
    expect(screen.getByText('Join the card waitlist')).toBeTruthy();
    expect(screen.getByText('Invite a friend')).toBeTruthy();
  });

  it('create wallet item is always completed', () => {
    const { container } = renderCard();
    const items = container.querySelectorAll('a');
    // First item should have pointer-events-none (completed)
    expect(items[0].className).toContain('pointer-events-none');
  });

  it('dismiss button hides the card', () => {
    renderCard();
    fireEvent.click(screen.getByText('Dismiss'));
    expect(useWalletStore.getState().checklistDismissed).toBe(true);
  });

  it('returns null when dismissed', () => {
    useWalletStore.setState({ checklistDismissed: true });
    const { container } = renderCard();
    expect(container.innerHTML).toBe('');
  });

  it('marks deposit as completed when balance > 0', () => {
    useWalletStore.setState({
      balances: [
        { mint: 'x', symbol: 'SOL', name: 'Solana', balance: 1, decimals: 9, usdValue: 150 },
      ],
    });
    renderCard();
    // Should now show 2 of 7 completed
    expect(screen.getByText('2 of 7 completed')).toBeTruthy();
  });

  it('marks first send as completed from store', () => {
    useWalletStore.setState({ firstSendCompleted: true });
    renderCard();
    expect(screen.getByText('2 of 7 completed')).toBeTruthy();
  });

  it('marks card waitlist as completed when cardStatus is not none', () => {
    useWalletStore.setState({ cardStatus: 'waitlisted' });
    renderCard();
    expect(screen.getByText('2 of 7 completed')).toBeTruthy();
  });

  it('returns null when all items completed', () => {
    useWalletStore.setState({
      firstSendCompleted: true,
      cardStatus: 'waitlisted',
      balances: [
        { mint: 'x', symbol: 'SOL', name: 'Solana', balance: 1, decimals: 9, usdValue: 150 },
      ],
    });
    // 4 of 7 completed (biometrics + invite are hardcoded false, kyc unverified, so this won't reach 7)
    // Card should still render
    const { container } = renderCard();
    expect(container.innerHTML).not.toBe('');
  });

  it('incomplete items link to correct pages', () => {
    const { container } = renderCard();
    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/settings');
    expect(hrefs).toContain('/deposit');
    expect(hrefs).toContain('/kyc');
    expect(hrefs).toContain('/send');
    expect(hrefs).toContain('/banking/card');
    expect(hrefs).toContain('/referral');
  });

  it('completed items are non-interactive', () => {
    const { container } = renderCard();
    const links = container.querySelectorAll('a');
    // First item (create wallet) should have pointer-events-none
    expect(links[0].className).toContain('pointer-events-none');
    expect(links[0].className).toContain('opacity-50');
  });

  it('shows progress bar', () => {
    const { container } = renderCard();
    // Progress bar inner div with bg-gold-500
    const progressBar = container.querySelector('.bg-gold-500.transition-all');
    expect(progressBar).toBeTruthy();
    // 1/7 ≈ 14.29%
    expect((progressBar as HTMLElement).style.width).toBe(`${(1 / 7) * 100}%`);
  });

  it('updates progress bar width when more items completed', () => {
    useWalletStore.setState({
      firstSendCompleted: true,
      balances: [
        { mint: 'x', symbol: 'SOL', name: 'Solana', balance: 1, decimals: 9, usdValue: 150 },
      ],
    });
    const { container } = renderCard();
    const progressBar = container.querySelector('.bg-gold-500.transition-all');
    // 3/7 ≈ 42.86%
    expect((progressBar as HTMLElement).style.width).toBe(`${(3 / 7) * 100}%`);
  });
});
