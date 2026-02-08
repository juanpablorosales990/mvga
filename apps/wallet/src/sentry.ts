import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Scrub potential private keys (base58 44-88 chars) and mnemonics from error reports
      const keyPattern = /[1-9A-HJ-NP-Za-km-z]{44,88}/g;

      function scrub(value: string | undefined): string | undefined {
        if (!value) return value;
        return value.replace(keyPattern, '[REDACTED_KEY]');
      }

      if (event.message) {
        event.message = scrub(event.message);
      }

      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          ex.value = scrub(ex.value);
        }
      }

      return event;
    },
  });
}

export { Sentry };
