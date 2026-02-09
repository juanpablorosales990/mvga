import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeTour from '../components/WelcomeTour';
import { useWalletStore } from '../stores/walletStore';

describe('WelcomeTour', () => {
  beforeEach(() => {
    useWalletStore.setState({ tourCompleted: false });
  });

  it('renders the first slide by default', () => {
    render(<WelcomeTour />);
    expect(screen.getByText('Welcome to MVGA')).toBeTruthy();
    expect(screen.getByText('Your digital dollar wallet on Solana')).toBeTruthy();
  });

  it('shows Skip button', () => {
    render(<WelcomeTour />);
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('shows Next button on first slide', () => {
    render(<WelcomeTour />);
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('advances to next slide on Next click', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Send & Receive')).toBeTruthy();
  });

  it('navigates through all 4 slides', () => {
    render(<WelcomeTour />);

    // Slide 1 -> 2
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Send & Receive')).toBeTruthy();

    // Slide 2 -> 3
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Earn Rewards')).toBeTruthy();

    // Slide 3 -> 4
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText("You're in Control")).toBeTruthy();
  });

  it('shows Get Started on last slide instead of Next', () => {
    render(<WelcomeTour />);

    // Navigate to last slide
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Get Started')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('completes tour on Get Started click', () => {
    render(<WelcomeTour />);

    // Navigate to last slide and click Get Started
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Get Started'));

    expect(useWalletStore.getState().tourCompleted).toBe(true);
  });

  it('completes tour on Skip click', () => {
    render(<WelcomeTour />);
    fireEvent.click(screen.getByText('Skip'));
    expect(useWalletStore.getState().tourCompleted).toBe(true);
  });

  it('renders 4 dot indicators', () => {
    const { container } = render(<WelcomeTour />);
    // Dots are divs inside the dot container (flex gap-2)
    const dotContainer = container.querySelector('.flex.gap-2');
    expect(dotContainer).toBeTruthy();
    expect(dotContainer!.children).toHaveLength(4);
  });

  it('swipe left advances to next slide', () => {
    const { container } = render(<WelcomeTour />);
    const tourEl = container.firstElementChild!;

    fireEvent.touchStart(tourEl, {
      touches: [{ clientX: 300 }],
    });
    fireEvent.touchEnd(tourEl, {
      changedTouches: [{ clientX: 100 }],
    });

    expect(screen.getByText('Send & Receive')).toBeTruthy();
  });

  it('swipe right on first slide does nothing', () => {
    const { container } = render(<WelcomeTour />);
    const tourEl = container.firstElementChild!;

    fireEvent.touchStart(tourEl, {
      touches: [{ clientX: 100 }],
    });
    fireEvent.touchEnd(tourEl, {
      changedTouches: [{ clientX: 300 }],
    });

    // Still on first slide
    expect(screen.getByText('Welcome to MVGA')).toBeTruthy();
  });

  it('small swipe (< 50px) does not advance', () => {
    const { container } = render(<WelcomeTour />);
    const tourEl = container.firstElementChild!;

    fireEvent.touchStart(tourEl, {
      touches: [{ clientX: 300 }],
    });
    fireEvent.touchEnd(tourEl, {
      changedTouches: [{ clientX: 270 }],
    });

    // Still on first slide
    expect(screen.getByText('Welcome to MVGA')).toBeTruthy();
  });
});
