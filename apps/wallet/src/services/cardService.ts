import type {
  CardDetails,
  CardTransaction,
  CardControls,
  CardBalance,
  CardStatus,
  KycSubmission,
} from './cardService.types';
import { API_URL } from '../config';

// ---------------------------------------------------------------------------
// Backend API — all card operations are proxied through MVGA API (Lithic).
// No client-side API key needed. Falls back to mock data when API is
// unavailable or in local dev without a backend.
// ---------------------------------------------------------------------------

async function apiFetchLocal<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Mock data — used when backend is unavailable
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_CARD: CardDetails = {
  id: 'card_mock_001',
  last4: '4242',
  expirationMonth: 12,
  expirationYear: 2028,
  brand: 'visa',
  status: 'active',
  cardholderName: 'MVGA USER',
  type: 'virtual',
  pan: '4242 4242 4242 4242',
};

const MOCK_TRANSACTIONS: CardTransaction[] = [
  {
    id: 'tx1',
    merchantName: 'Amazon',
    merchantCategory: 'online',
    amount: 34.99,
    currency: 'USD',
    date: '2026-02-05T14:30:00Z',
    status: 'completed',
  },
  {
    id: 'tx2',
    merchantName: 'Uber',
    merchantCategory: 'transport',
    amount: 12.5,
    currency: 'USD',
    date: '2026-02-04T09:15:00Z',
    status: 'completed',
  },
  {
    id: 'tx3',
    merchantName: 'Spotify',
    merchantCategory: 'entertainment',
    amount: 9.99,
    currency: 'USD',
    date: '2026-02-01T00:00:00Z',
    status: 'completed',
  },
  {
    id: 'tx4',
    merchantName: 'Mercado Libre',
    merchantCategory: 'online',
    amount: 67.0,
    currency: 'USD',
    date: '2026-01-30T16:45:00Z',
    status: 'completed',
  },
  {
    id: 'tx5',
    merchantName: "McDonald's",
    merchantCategory: 'restaurant',
    amount: 8.49,
    currency: 'USD',
    date: '2026-01-29T12:20:00Z',
    status: 'completed',
  },
];

let mockBalance: CardBalance = { available: 250.0, pending: 0.99 };
let mockControls: CardControls = {
  dailySpendLimit: 1000,
  onlineTransactions: true,
  internationalTransactions: true,
};
let mockCardStatus: CardDetails['status'] = 'active';

// ---------------------------------------------------------------------------
// Service functions — try backend first, fall back to mock
// ---------------------------------------------------------------------------

function getWalletAddress(): string | null {
  try {
    const store = JSON.parse(localStorage.getItem('mvga-wallet-storage') || '{}');
    const pk = store?.state?.publicKey;
    if (typeof pk !== 'string' || pk.length < 32 || pk.length > 44) return null;
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(pk)) return null;
    return pk;
  } catch {
    return null;
  }
}

export async function getCardDetails(): Promise<CardDetails | null> {
  const wallet = getWalletAddress();
  if (!wallet) return null;

  try {
    return await apiFetchLocal<CardDetails>('/banking/card');
  } catch {
    await delay(300);
    return { ...MOCK_CARD, status: mockCardStatus };
  }
}

export async function getCardBalance(): Promise<CardBalance> {
  const wallet = getWalletAddress();
  if (!wallet) return { available: 0, pending: 0 };

  try {
    return await apiFetchLocal<CardBalance>('/banking/card/balance');
  } catch {
    await delay(200);
    return { ...mockBalance };
  }
}

export async function getCardTransactions(): Promise<CardTransaction[]> {
  const wallet = getWalletAddress();
  if (!wallet) return [];

  try {
    return await apiFetchLocal<CardTransaction[]>('/banking/card/transactions');
  } catch {
    await delay(400);
    return [...MOCK_TRANSACTIONS];
  }
}

export async function getCardControls(): Promise<CardControls> {
  // Card controls are local state for now
  await delay(200);
  return { ...mockControls };
}

export async function freezeCard(): Promise<CardDetails> {
  const wallet = getWalletAddress();
  if (wallet) {
    try {
      return await apiFetchLocal<CardDetails>('/banking/card/freeze', { method: 'POST' });
    } catch {
      // fall through to mock
    }
  }
  await delay(500);
  mockCardStatus = 'frozen';
  return { ...MOCK_CARD, status: 'frozen' };
}

export async function unfreezeCard(): Promise<CardDetails> {
  const wallet = getWalletAddress();
  if (wallet) {
    try {
      return await apiFetchLocal<CardDetails>('/banking/card/unfreeze', {
        method: 'POST',
      });
    } catch {
      // fall through to mock
    }
  }
  await delay(500);
  mockCardStatus = 'active';
  return { ...MOCK_CARD, status: 'active' };
}

export async function updateCardControls(controls: Partial<CardControls>): Promise<CardControls> {
  await delay(300);
  mockControls = { ...mockControls, ...controls };
  return { ...mockControls };
}

export async function fundCard(
  amountUsdc: number
): Promise<{ success: boolean; newBalance: CardBalance }> {
  const wallet = getWalletAddress();
  if (wallet) {
    try {
      return await apiFetchLocal<{ success: boolean; newBalance: CardBalance }>(
        '/banking/card/fund',
        { method: 'POST', body: JSON.stringify({ amount: amountUsdc }) }
      );
    } catch {
      // fall through to mock
    }
  }
  await delay(800);
  mockBalance = {
    available: mockBalance.available + amountUsdc,
    pending: mockBalance.pending,
  };
  return { success: true, newBalance: { ...mockBalance } };
}

export async function submitKyc(data: KycSubmission): Promise<{
  status: CardStatus;
  userId?: string;
  applicationId?: string;
  lithicAccountToken?: string;
}> {
  try {
    return await apiFetchLocal<{
      status: CardStatus;
      userId?: string;
      applicationId?: string;
      lithicAccountToken?: string;
    }>('/banking/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch {
    await delay(1000);
    return { status: 'kyc_approved' };
  }
}

export async function issueCard(_userId: string): Promise<CardDetails | null> {
  const wallet = getWalletAddress();
  if (wallet) {
    try {
      return await apiFetchLocal<CardDetails>('/banking/card/issue', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: wallet }),
      });
    } catch {
      // fall through to mock
    }
  }
  await delay(500);
  return { ...MOCK_CARD };
}

export async function provisionCard(digitalWallet: 'APPLE_PAY' | 'GOOGLE_PAY'): Promise<{
  jws?: {
    header?: Record<string, unknown>;
    payload?: string;
    protected?: string;
    signature?: string;
  };
  state?: string;
  google_opc?: string;
  tsp_opc?: string;
}> {
  return apiFetchLocal('/banking/card/provision', {
    method: 'POST',
    body: JSON.stringify({ digitalWallet }),
  });
}

export async function getUserStatus(_userId: string): Promise<{ status: CardStatus }> {
  const wallet = getWalletAddress();
  if (wallet) {
    try {
      return await apiFetchLocal<{ status: CardStatus }>('/banking/kyc/status');
    } catch {
      // fall through to mock
    }
  }
  await delay(300);
  return { status: 'kyc_approved' };
}
