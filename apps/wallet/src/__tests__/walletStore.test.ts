import { describe, it, expect, beforeEach } from 'vitest';
import { useWalletStore, TOKENS } from '../stores/walletStore';
import type { TokenBalance } from '../stores/walletStore';

describe('walletStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useWalletStore.setState({
      publicKey: null,
      isConnected: false,
      balances: [],
      totalUsdValue: 0,
      isLoadingBalances: false,
      activeTab: 'wallet',
      preferredCurrency: 'USD',
      addressBook: [],
      autoCompoundDefault: false,
      readNotifications: [],
      savingsGoal: null,
      cardStatus: 'none',
      balanceVersion: 0,
      recentRecipients: [],
      priceAlerts: [],
    });
  });

  describe('wallet connection', () => {
    it('sets public key and marks connected', () => {
      useWalletStore.getState().setPublicKey('ABC123');
      const state = useWalletStore.getState();
      expect(state.publicKey).toBe('ABC123');
      expect(state.isConnected).toBe(true);
    });

    it('disconnects and clears state', () => {
      useWalletStore.getState().setPublicKey('ABC123');
      useWalletStore
        .getState()
        .setBalances([
          { mint: 'x', symbol: 'SOL', name: 'Solana', balance: 1, decimals: 9, usdValue: 150 },
        ]);

      useWalletStore.getState().disconnect();
      const state = useWalletStore.getState();
      expect(state.publicKey).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.balances).toHaveLength(0);
      expect(state.totalUsdValue).toBe(0);
    });

    it('setting publicKey to null marks disconnected', () => {
      useWalletStore.getState().setPublicKey('ABC123');
      useWalletStore.getState().setPublicKey(null);
      expect(useWalletStore.getState().isConnected).toBe(false);
    });
  });

  describe('balances', () => {
    const mockBalances: TokenBalance[] = [
      {
        mint: TOKENS.SOL.mint,
        symbol: 'SOL',
        name: 'Solana',
        balance: 2,
        decimals: 9,
        usdValue: 300,
      },
      {
        mint: TOKENS.USDC.mint,
        symbol: 'USDC',
        name: 'USD Coin',
        balance: 50,
        decimals: 6,
        usdValue: 50,
      },
    ];

    it('sets balances and calculates totalUsdValue', () => {
      useWalletStore.getState().setBalances(mockBalances);
      const state = useWalletStore.getState();
      expect(state.balances).toHaveLength(2);
      expect(state.totalUsdValue).toBe(350);
    });

    it('recalculates totalUsdValue on balance update', () => {
      useWalletStore.getState().setBalances(mockBalances);
      useWalletStore.getState().setBalances([mockBalances[0]]);
      expect(useWalletStore.getState().totalUsdValue).toBe(300);
    });

    it('sets loading state', () => {
      useWalletStore.getState().setLoadingBalances(true);
      expect(useWalletStore.getState().isLoadingBalances).toBe(true);
      useWalletStore.getState().setLoadingBalances(false);
      expect(useWalletStore.getState().isLoadingBalances).toBe(false);
    });

    it('increments balanceVersion on invalidate', () => {
      expect(useWalletStore.getState().balanceVersion).toBe(0);
      useWalletStore.getState().invalidateBalances();
      expect(useWalletStore.getState().balanceVersion).toBe(1);
      useWalletStore.getState().invalidateBalances();
      expect(useWalletStore.getState().balanceVersion).toBe(2);
    });
  });

  describe('address book', () => {
    it('adds an address', () => {
      useWalletStore.getState().addAddress({ label: 'Alice', address: 'addr1' });
      const book = useWalletStore.getState().addressBook;
      expect(book).toHaveLength(1);
      expect(book[0].label).toBe('Alice');
      expect(book[0].address).toBe('addr1');
      expect(book[0].createdAt).toBeGreaterThan(0);
    });

    it('overwrites duplicate address with new label', () => {
      useWalletStore.getState().addAddress({ label: 'Alice', address: 'addr1' });
      useWalletStore.getState().addAddress({ label: 'Alice Updated', address: 'addr1' });
      const book = useWalletStore.getState().addressBook;
      expect(book).toHaveLength(1);
      expect(book[0].label).toBe('Alice Updated');
    });

    it('removes an address', () => {
      useWalletStore.getState().addAddress({ label: 'Alice', address: 'addr1' });
      useWalletStore.getState().addAddress({ label: 'Bob', address: 'addr2' });
      useWalletStore.getState().removeAddress('addr1');
      const book = useWalletStore.getState().addressBook;
      expect(book).toHaveLength(1);
      expect(book[0].address).toBe('addr2');
    });

    it('removing non-existent address is a no-op', () => {
      useWalletStore.getState().addAddress({ label: 'Alice', address: 'addr1' });
      useWalletStore.getState().removeAddress('nonexistent');
      expect(useWalletStore.getState().addressBook).toHaveLength(1);
    });
  });

  describe('notifications', () => {
    it('marks a notification as read', () => {
      useWalletStore.getState().markNotificationRead('notif-1');
      expect(useWalletStore.getState().readNotifications).toContain('notif-1');
    });

    it('does not duplicate read notifications', () => {
      useWalletStore.getState().markNotificationRead('notif-1');
      useWalletStore.getState().markNotificationRead('notif-1');
      expect(
        useWalletStore.getState().readNotifications.filter((n) => n === 'notif-1')
      ).toHaveLength(1);
    });

    it('marks all notifications as read', () => {
      useWalletStore.getState().markNotificationRead('notif-1');
      useWalletStore.getState().markAllNotificationsRead(['notif-2', 'notif-3']);
      const read = useWalletStore.getState().readNotifications;
      expect(read).toContain('notif-1');
      expect(read).toContain('notif-2');
      expect(read).toContain('notif-3');
    });

    it('deduplicates when marking all', () => {
      useWalletStore.getState().markNotificationRead('notif-1');
      useWalletStore.getState().markAllNotificationsRead(['notif-1', 'notif-2']);
      expect(useWalletStore.getState().readNotifications).toHaveLength(2);
    });
  });

  describe('settings', () => {
    it('sets preferred currency', () => {
      useWalletStore.getState().setPreferredCurrency('VES');
      expect(useWalletStore.getState().preferredCurrency).toBe('VES');
    });

    it('sets active tab', () => {
      useWalletStore.getState().setActiveTab('send');
      expect(useWalletStore.getState().activeTab).toBe('send');
    });

    it('sets auto-compound default', () => {
      useWalletStore.getState().setAutoCompoundDefault(true);
      expect(useWalletStore.getState().autoCompoundDefault).toBe(true);
    });

    it('sets savings goal', () => {
      useWalletStore.getState().setSavingsGoal({ targetAmount: 1000, label: 'Emergency' });
      expect(useWalletStore.getState().savingsGoal).toEqual({
        targetAmount: 1000,
        label: 'Emergency',
      });
    });

    it('clears savings goal', () => {
      useWalletStore.getState().setSavingsGoal({ targetAmount: 1000, label: 'Test' });
      useWalletStore.getState().setSavingsGoal(null);
      expect(useWalletStore.getState().savingsGoal).toBeNull();
    });

    it('sets card status', () => {
      useWalletStore.getState().setCardStatus('active');
      expect(useWalletStore.getState().cardStatus).toBe('active');
    });

    it('sets card waitlisted', () => {
      useWalletStore.getState().setCardWaitlisted(true);
      expect(useWalletStore.getState().cardStatus).toBe('waitlisted');
      useWalletStore.getState().setCardWaitlisted(false);
      expect(useWalletStore.getState().cardStatus).toBe('none');
    });
  });

  describe('recent recipients', () => {
    it('adds a recent recipient', () => {
      useWalletStore.getState().addRecentRecipient('addr1', 'Alice');
      const recipients = useWalletStore.getState().recentRecipients;
      expect(recipients).toHaveLength(1);
      expect(recipients[0].address).toBe('addr1');
      expect(recipients[0].label).toBe('Alice');
      expect(recipients[0].lastUsed).toBeGreaterThan(0);
    });

    it('adds a recipient without label', () => {
      useWalletStore.getState().addRecentRecipient('addr1');
      const recipients = useWalletStore.getState().recentRecipients;
      expect(recipients).toHaveLength(1);
      expect(recipients[0].address).toBe('addr1');
      expect(recipients[0].label).toBeUndefined();
    });

    it('deduplicates and moves to top on repeat', () => {
      useWalletStore.getState().addRecentRecipient('addr1', 'Alice');
      useWalletStore.getState().addRecentRecipient('addr2', 'Bob');
      useWalletStore.getState().addRecentRecipient('addr1', 'Alice Updated');

      const recipients = useWalletStore.getState().recentRecipients;
      expect(recipients).toHaveLength(2);
      expect(recipients[0].address).toBe('addr1');
      expect(recipients[0].label).toBe('Alice Updated');
      expect(recipients[1].address).toBe('addr2');
    });

    it('keeps max 5 recipients', () => {
      for (let i = 1; i <= 6; i++) {
        useWalletStore.getState().addRecentRecipient(`addr${i}`, `User${i}`);
      }
      const recipients = useWalletStore.getState().recentRecipients;
      expect(recipients).toHaveLength(5);
      // Most recent should be first
      expect(recipients[0].address).toBe('addr6');
      // Oldest (addr1) should be evicted
      expect(recipients.find((r) => r.address === 'addr1')).toBeUndefined();
    });

    it('most recently used is always first', () => {
      useWalletStore.getState().addRecentRecipient('addr1');
      useWalletStore.getState().addRecentRecipient('addr2');
      useWalletStore.getState().addRecentRecipient('addr3');

      // Touch addr1 again — should move to front
      useWalletStore.getState().addRecentRecipient('addr1');

      const recipients = useWalletStore.getState().recentRecipients;
      expect(recipients[0].address).toBe('addr1');
      expect(recipients[1].address).toBe('addr3');
      expect(recipients[2].address).toBe('addr2');
    });
  });

  describe('price alerts', () => {
    it('adds a price alert', () => {
      useWalletStore.getState().addPriceAlert({
        token: 'SOL',
        condition: 'above',
        targetPrice: 200,
      });
      const alerts = useWalletStore.getState().priceAlerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].token).toBe('SOL');
      expect(alerts[0].condition).toBe('above');
      expect(alerts[0].targetPrice).toBe(200);
      expect(alerts[0].triggered).toBe(false);
    });

    it('removes a price alert', () => {
      useWalletStore.getState().addPriceAlert({
        token: 'SOL',
        condition: 'above',
        targetPrice: 200,
      });
      const id = useWalletStore.getState().priceAlerts[0].id;
      useWalletStore.getState().removePriceAlert(id);
      expect(useWalletStore.getState().priceAlerts).toHaveLength(0);
    });

    it('triggers a price alert', () => {
      useWalletStore.getState().addPriceAlert({
        token: 'SOL',
        condition: 'below',
        targetPrice: 100,
      });
      const id = useWalletStore.getState().priceAlerts[0].id;
      useWalletStore.getState().triggerPriceAlert(id);
      expect(useWalletStore.getState().priceAlerts[0].triggered).toBe(true);
    });
  });

  describe('TOKENS constants', () => {
    it('has correct MVGA token mint', () => {
      expect(TOKENS.MVGA.mint).toBe('DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh');
    });

    it('has correct token decimals', () => {
      expect(TOKENS.SOL.decimals).toBe(9);
      expect(TOKENS.USDC.decimals).toBe(6);
      expect(TOKENS.USDT.decimals).toBe(6);
      expect(TOKENS.MVGA.decimals).toBe(9);
    });
  });
});
