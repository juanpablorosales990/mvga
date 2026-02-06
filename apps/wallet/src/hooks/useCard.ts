import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import * as cardService from '../services/cardService';
import type {
  CardDetails,
  CardTransaction,
  CardControls,
  CardBalance,
  KycSubmission,
} from '../services/cardService.types';

export function useCard() {
  const cardStatus = useWalletStore((s) => s.cardStatus);
  const setCardStatus = useWalletStore((s) => s.setCardStatus);

  const [card, setCard] = useState<CardDetails | null>(null);
  const [balance, setBalance] = useState<CardBalance | null>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [controls, setControls] = useState<CardControls | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCardData = useCallback(async () => {
    if (cardStatus !== 'active' && cardStatus !== 'frozen') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cardData, balanceData, txData, controlsData] = await Promise.all([
        cardService.getCardDetails(),
        cardService.getCardBalance(),
        cardService.getCardTransactions(),
        cardService.getCardControls(),
      ]);
      setCard(cardData);
      setBalance(balanceData);
      setTransactions(txData);
      setControls(controlsData);
    } catch {
      // silently fail for mock
    } finally {
      setLoading(false);
    }
  }, [cardStatus]);

  useEffect(() => {
    loadCardData();
  }, [loadCardData]);

  const toggleFreeze = useCallback(async () => {
    if (!card) return;
    const result =
      card.status === 'active' ? await cardService.freezeCard() : await cardService.unfreezeCard();
    setCard(result);
    setCardStatus(result.status);
  }, [card, setCardStatus]);

  const updateControls = useCallback(async (updates: Partial<CardControls>) => {
    const result = await cardService.updateCardControls(updates);
    setControls(result);
  }, []);

  const fundCard = useCallback(async (amount: number) => {
    const result = await cardService.fundCard(amount);
    if (result.success) {
      setBalance(result.newBalance);
    }
    return result.success;
  }, []);

  const submitKyc = useCallback(
    async (data: KycSubmission) => {
      const result = await cardService.submitKyc(data);
      setCardStatus(result.status);
      // If approved, automatically issue the card
      if (result.status === 'kyc_approved' && result.userId) {
        const issuedCard = await cardService.issueCard(result.userId);
        if (issuedCard) {
          setCard(issuedCard);
          setCardStatus('active');
        }
      }
      return result.status;
    },
    [setCardStatus]
  );

  const issueCard = useCallback(
    async (userId: string) => {
      const issuedCard = await cardService.issueCard(userId);
      if (issuedCard) {
        setCard(issuedCard);
        setCardStatus('active');
        await loadCardData();
      }
      return issuedCard;
    },
    [setCardStatus, loadCardData]
  );

  return {
    cardStatus,
    card,
    balance,
    transactions,
    controls,
    loading,
    toggleFreeze,
    updateControls,
    fundCard,
    submitKyc,
    issueCard,
    reload: loadCardData,
  };
}
