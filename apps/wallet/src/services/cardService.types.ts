/**
 * Card service types — matches Lithic API shape.
 * When Lithic is configured, the service calls Lithic's sandbox/production.
 * Otherwise, falls back to mock data.
 */

export type CardStatus =
  | 'none'
  | 'waitlisted'
  | 'kyc_pending'
  | 'kyc_approved'
  | 'active'
  | 'frozen';

export interface CardDetails {
  id: string;
  last4: string;
  expirationMonth: number;
  expirationYear: number;
  brand: 'visa';
  status: CardStatus;
  cardholderName: string;
  type: 'virtual' | 'physical';
  pan?: string;
}

export interface CardTransaction {
  id: string;
  merchantName: string;
  merchantCategory: 'online' | 'restaurant' | 'transport' | 'entertainment' | 'grocery' | 'other';
  amount: number;
  currency: string;
  date: string;
  status: 'completed' | 'pending' | 'declined';
}

export interface CardControls {
  dailySpendLimit: number;
  onlineTransactions: boolean;
  internationalTransactions: boolean;
}

export interface CardBalance {
  /** Available USDC to spend, in dollars */
  available: number;
  /** Pending transaction amount, in dollars */
  pending: number;
}

export interface KycSubmission {
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth: string;
  address: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
  nationalIdType: 'cedula' | 'passport' | 'drivers_license';
  nationalId: string;
}
