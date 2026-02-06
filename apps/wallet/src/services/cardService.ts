import type {
  CardDetails,
  CardTransaction,
  CardControls,
  CardBalance,
  CardStatus,
  KycSubmission,
  RainUserApplication,
  RainCard,
  RainBalance,
} from './cardService.types';

// ---------------------------------------------------------------------------
// Rain API configuration
// Set VITE_RAIN_API_KEY and VITE_RAIN_API_URL in .env to use Rain sandbox.
// When not set, falls back to mock data for local development.
// ---------------------------------------------------------------------------

const RAIN_API_KEY = import.meta.env.VITE_RAIN_API_KEY as string | undefined;
const RAIN_API_URL =
  (import.meta.env.VITE_RAIN_API_URL as string) || 'https://api-dev.raincards.xyz/v1';
const USE_RAIN = !!RAIN_API_KEY;

async function rainFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${RAIN_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': RAIN_API_KEY!,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Rain API ${res.status}: ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Mock data — used when VITE_RAIN_API_KEY is not set
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
  {
    id: 'tx6',
    merchantName: 'Apple',
    merchantCategory: 'online',
    amount: 0.99,
    currency: 'USD',
    date: '2026-01-28T10:00:00Z',
    status: 'pending',
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
// Helpers: map Rain API responses → our internal types
// ---------------------------------------------------------------------------

function mapRainCard(rain: RainCard, name: string): CardDetails {
  return {
    id: rain.id,
    last4: rain.last4,
    expirationMonth: rain.expirationMonth,
    expirationYear: rain.expirationYear,
    brand: 'visa',
    status: rain.status === 'frozen' ? 'frozen' : 'active',
    cardholderName: name,
    type: rain.type,
  };
}

function mapRainBalance(rain: RainBalance): CardBalance {
  return {
    available: rain.spendingPower / 100,
    pending: rain.balanceDue / 100,
  };
}

// Rain userId cache (survives page refreshes within session)
function getRainUserId(): string | null {
  return sessionStorage.getItem('rain_user_id');
}
function setRainUserId(id: string) {
  sessionStorage.setItem('rain_user_id', id);
}

// ---------------------------------------------------------------------------
// Service functions — Rain sandbox when API key is set, mock otherwise
// ---------------------------------------------------------------------------

export async function getCardDetails(): Promise<CardDetails | null> {
  if (USE_RAIN) {
    const userId = getRainUserId();
    if (!userId) return null;
    const cards = await rainFetch<RainCard[]>(`/issuing/cards?userId=${userId}&limit=1`);
    if (!cards.length) return null;
    return mapRainCard(cards[0], 'MVGA USER');
  }
  await delay(300);
  return { ...MOCK_CARD, status: mockCardStatus };
}

export async function getCardBalance(): Promise<CardBalance> {
  if (USE_RAIN) {
    const userId = getRainUserId();
    if (!userId) return { available: 0, pending: 0 };
    const balance = await rainFetch<RainBalance>(`/issuing/users/${userId}/balances`);
    return mapRainBalance(balance);
  }
  await delay(200);
  return { ...mockBalance };
}

export async function getCardTransactions(): Promise<CardTransaction[]> {
  // Rain transaction history endpoint shape is TBD.
  // Use mock transactions for now; replace when sandbox is available.
  if (USE_RAIN) {
    return [...MOCK_TRANSACTIONS];
  }
  await delay(400);
  return [...MOCK_TRANSACTIONS];
}

export async function getCardControls(): Promise<CardControls> {
  // Card controls are local state — Rain doesn't expose this via API
  await delay(200);
  return { ...mockControls };
}

export async function freezeCard(): Promise<CardDetails> {
  if (USE_RAIN) {
    // TODO: PATCH /issuing/cards/{cardId} { status: 'frozen' }
  }
  await delay(500);
  mockCardStatus = 'frozen';
  return { ...MOCK_CARD, status: 'frozen' };
}

export async function unfreezeCard(): Promise<CardDetails> {
  if (USE_RAIN) {
    // TODO: PATCH /issuing/cards/{cardId} { status: 'active' }
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
  if (USE_RAIN) {
    // Production flow:
    // 1. GET /issuing/users/{userId}/contracts → get depositAddress
    // 2. Send USDC on-chain to depositAddress via Solana transfer
    // 3. Poll balance until it reflects the deposit
  }
  await delay(800);
  mockBalance = {
    available: mockBalance.available + amountUsdc,
    pending: mockBalance.pending,
  };
  return { success: true, newBalance: { ...mockBalance } };
}

export async function submitKyc(
  data: KycSubmission
): Promise<{ status: CardStatus; userId?: string }> {
  if (USE_RAIN) {
    const result = await rainFetch<RainUserApplication>('/issuing/applications/user', {
      method: 'POST',
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        walletAddress: data.walletAddress,
        birthDate: data.dateOfBirth,
        nationalId: data.nationalId,
        countryOfIssue: data.address.countryCode,
        address: data.address,
        isTermsOfServiceAccepted: true,
      }),
    });
    setRainUserId(result.id);
    const statusMap: Record<string, CardStatus> = {
      approved: 'kyc_approved',
      pending: 'kyc_pending',
      rejected: 'none',
    };
    return {
      status: statusMap[result.applicationStatus] || 'kyc_pending',
      userId: result.id,
    };
  }
  await delay(1000);
  return { status: 'kyc_approved' };
}

export async function issueCard(userId: string): Promise<CardDetails | null> {
  if (USE_RAIN) {
    // Deploy collateral smart contract
    await rainFetch(`/issuing/users/${userId}/contracts`, {
      method: 'POST',
      body: JSON.stringify({ chainId: 84532 }), // Base Sepolia for sandbox
    });
    // Issue virtual Visa card
    const card = await rainFetch<RainCard>(`/issuing/users/${userId}/cards`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'virtual',
        limit: { frequency: 'allTime', amount: 10000 },
        displayName: 'MVGA Card',
        status: 'active',
      }),
    });
    return mapRainCard(card, 'MVGA USER');
  }
  await delay(500);
  return { ...MOCK_CARD };
}

export async function getUserStatus(userId: string): Promise<{ status: CardStatus }> {
  if (USE_RAIN) {
    const app = await rainFetch<RainUserApplication>(`/issuing/applications/user/${userId}`);
    const statusMap: Record<string, CardStatus> = {
      approved: 'kyc_approved',
      pending: 'kyc_pending',
      rejected: 'none',
    };
    return { status: statusMap[app.applicationStatus] || 'kyc_pending' };
  }
  await delay(300);
  return { status: 'kyc_approved' };
}

/** Check if running against Rain sandbox */
export function isRainEnabled(): boolean {
  return USE_RAIN;
}
