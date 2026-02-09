import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    localStorage.removeItem('mvga-biometric-enabled');
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
    // 1 of 6 completed (create wallet is always checked; invite step removed)
    expect(screen.getByText('1 of 6 completed')).toBeTruthy();
  });

  it('collapses by default (shows top 3 incomplete items)', () => {
    renderCard();
    expect(screen.getByText('Secure with biometrics')).toBeTruthy();
    expect(screen.getByText('Make your first deposit')).toBeTruthy();
    expect(screen.getByText('Verify your identity')).toBeTruthy();

    // Completed/other steps are hidden until expanded.
    expect(screen.queryByText('Create your wallet')).toBeNull();
    expect(screen.queryByText('Send your first payment')).toBeNull();
    expect(screen.queryByText('Join the card waitlist')).toBeNull();
  });

  it('expands to show all steps (including completed)', () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByText('Show all steps'));

    // Now all 6 items should be visible
    expect(screen.getByText('Create your wallet')).toBeTruthy();
    expect(screen.getByText('Secure with biometrics')).toBeTruthy();
    expect(screen.getByText('Make your first deposit')).toBeTruthy();
    expect(screen.getByText('Verify your identity')).toBeTruthy();
    expect(screen.getByText('Send your first payment')).toBeTruthy();
    expect(screen.getByText('Join the card waitlist')).toBeTruthy();

    const links = container.querySelectorAll('a');
    // First item (create wallet) should be completed and non-interactive in expanded view
    expect(links[0].className).toContain('pointer-events-none');
    expect(links[0].className).toContain('opacity-50');
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
    // Should now show 2 of 6 completed
    expect(screen.getByText('2 of 6 completed')).toBeTruthy();
  });

  it('marks first send as completed from store', () => {
    useWalletStore.setState({ firstSendCompleted: true });
    renderCard();
    expect(screen.getByText('2 of 6 completed')).toBeTruthy();
  });

  it('marks card waitlist as completed when cardStatus is not none', () => {
    useWalletStore.setState({ cardStatus: 'waitlisted' });
    renderCard();
    expect(screen.getByText('2 of 6 completed')).toBeTruthy();
  });

  it('returns null when all items completed', async () => {
    // Enable biometrics via localStorage (useBiometric reads this on mount).
    localStorage.setItem('mvga-biometric-enabled', 'true');
    useWalletStore.setState({
      firstSendCompleted: true,
      cardStatus: 'waitlisted',
      balances: [
        { mint: 'x', symbol: 'SOL', name: 'Solana', balance: 1, decimals: 9, usdValue: 150 },
      ],
      kycStatus: 'APPROVED',
    });
    const { container } = renderCard();

    // Initially rendered, then hidden after the biometrics hook updates state.
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('expanded view links to correct pages', () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByText('Show all steps'));

    const links = container.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/settings');
    expect(hrefs).toContain('/deposit');
    expect(hrefs).toContain('/kyc');
    expect(hrefs).toContain('/send');
    expect(hrefs).toContain('/banking/card');
  });

  it('completed items are non-interactive', () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByText('Show all steps'));
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
    // 1/6 ≈ 16.67%
    expect((progressBar as HTMLElement).style.width).toBe(`${(1 / 6) * 100}%`);
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
    // 3/6 = 50%
    expect((progressBar as HTMLElement).style.width).toBe(`${(3 / 6) * 100}%`);
  });
});
