import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface PersonaInquiry {
  inquiryId: string;
  status: string;
  referenceId: string;
}

@Injectable()
export class PersonaAdapter {
  private readonly logger = new Logger(PersonaAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly templateId: string | undefined;
  private readonly environmentId: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly apiUrl = 'https://withpersona.com/api/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PERSONA_API_KEY');
    this.templateId = this.config.get<string>('PERSONA_TEMPLATE_ID');
    this.environmentId = this.config.get<string>('PERSONA_ENVIRONMENT_ID');
    this.webhookSecret = this.config.get<string>('PERSONA_WEBHOOK_SECRET');
  }

  get isEnabled(): boolean {
    return !!(this.apiKey && this.templateId);
  }

  /** Template ID for the wallet frontend to initialize the SDK. */
  get templateConfig() {
    return {
      templateId: this.templateId || '',
      environmentId: this.environmentId || '',
    };
  }

  private async fetch<T>(method: string, path: string, body?: object): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Persona API key not configured');
    }

    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Persona-Version': '2023-01-05',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Persona API ${res.status} ${path}: ${text}`);
      throw new Error(`Persona API error: ${res.status}`);
    }

    return res.json();
  }

  /** Pre-create an inquiry for a user. Returns the inquiry ID for the embedded flow. */
  async createInquiry(referenceId: string): Promise<string> {
    const result = await this.fetch<{ data: { id: string } }>('POST', '/inquiries', {
      data: {
        type: 'inquiry',
        attributes: {
          'inquiry-template-id': this.templateId,
          'reference-id': referenceId,
        },
      },
    });
    return result.data.id;
  }

  /** Get inquiry status by ID. */
  async getInquiryStatus(inquiryId: string): Promise<PersonaInquiry> {
    if (!inquiryId || !/^inq_[a-zA-Z0-9_-]+$/.test(inquiryId)) {
      throw new Error('Invalid inquiry ID format');
    }
    const result = await this.fetch<{
      data: {
        id: string;
        attributes: { status: string; 'reference-id': string };
      };
    }>('GET', `/inquiries/${inquiryId}`);

    return {
      inquiryId: result.data.id,
      status: result.data.attributes.status,
      referenceId: result.data.attributes['reference-id'],
    };
  }

  /**
   * Verify a Persona webhook signature.
   * Header format: "t=<timestamp>,v1=<sig1> v1=<sig2>"
   * HMAC input: "<timestamp>.<rawBody>"
   */
  parseWebhookPayload(rawBody: string, signatureHeader: string): Record<string, unknown> | null {
    if (!this.webhookSecret) {
      this.logger.warn('Persona webhook secret not configured');
      return null;
    }

    if (!signatureHeader) {
      this.logger.warn('Missing Persona-Signature header');
      return null;
    }

    // Parse "t=<ts>,v1=<sig1> v1=<sig2>"
    const parts = signatureHeader.split(',');
    const tPart = parts.find((p) => p.startsWith('t='));
    if (!tPart) {
      this.logger.warn('Missing timestamp in Persona-Signature');
      return null;
    }
    const timestamp = tPart.split('=')[1];

    // Reject webhooks older than 5 minutes to prevent replay attacks
    const timestampAge = Date.now() / 1000 - parseInt(timestamp, 10);
    if (isNaN(timestampAge) || timestampAge > 300 || timestampAge < -60) {
      this.logger.warn(`Persona webhook timestamp too old or invalid: ${timestamp}`);
      return null;
    }

    // Extract all v1 signatures (space-separated after the timestamp part)
    const sigParts = signatureHeader.split(' ').filter((p) => p.includes('v1='));
    const signatures = sigParts.map((p) => p.split('v1=')[1]).filter(Boolean);

    if (signatures.length === 0) {
      this.logger.warn('No v1 signatures found in Persona-Signature');
      return null;
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const isValid = signatures.some((sig) => {
      const isHex = /^[0-9a-fA-F]+$/.test(sig) && sig.length % 2 === 0;
      if (!isHex) return false;
      const sigBuf = Buffer.from(sig, 'hex');
      return expectedBuf.length === sigBuf.length && timingSafeEqual(expectedBuf, sigBuf);
    });

    if (!isValid) {
      this.logger.warn('Invalid Persona webhook signature');
      return null;
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      this.logger.warn('Invalid Persona webhook JSON');
      return null;
    }
  }
}
