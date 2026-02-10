import { describe, it, expect } from 'vitest';
import { findBestMatch, findTopMatches } from '../lib/faqMatcher';
import { faqDatabase, FaqEntry } from '../lib/faqDatabase';

describe('faqMatcher', () => {
  describe('findBestMatch', () => {
    it('matches "how to deposit" to deposit FAQ', () => {
      const result = findBestMatch('how to deposit', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.category).toBe('deposits');
    });

    it('matches "como depositar" (Spanish) to deposit FAQ', () => {
      const result = findBestMatch('como depositar', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.category).toBe('deposits');
    });

    it('matches "lost password" to security FAQ', () => {
      const result = findBestMatch('lost password', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.id).toBe('lost-password');
    });

    it('matches "perdi contraseña" (Spanish with accent) to security FAQ', () => {
      const result = findBestMatch('perdí contraseña', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.id).toBe('lost-password');
    });

    it('matches "fees comisiones cost" to fees FAQ', () => {
      const result = findBestMatch('fees comisiones cost', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.category).toBe('fees');
    });

    it('matches "escrow P2P trade" to P2P FAQ', () => {
      const result = findBestMatch('escrow P2P trade', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.category).toBe('p2p');
    });

    it('matches "tarjeta card visa kyc" to card FAQ', () => {
      const result = findBestMatch('tarjeta card visa kyc', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.category).toBe('card');
    });

    it('returns null for empty query', () => {
      expect(findBestMatch('', faqDatabase)).toBeNull();
    });

    it('returns null for single character', () => {
      expect(findBestMatch('a', faqDatabase)).toBeNull();
    });

    it('returns null for gibberish', () => {
      expect(findBestMatch('xyzqwertyzxcv', faqDatabase)).toBeNull();
    });

    it('strips accents for matching', () => {
      const result = findBestMatch('qué es mvga', faqDatabase);
      expect(result).not.toBeNull();
      expect(result!.faq.id).toBe('what-is-mvga');
    });
  });

  describe('findTopMatches', () => {
    it('returns multiple results sorted by score', () => {
      const results = findTopMatches('send crypto', faqDatabase);
      expect(results.length).toBeGreaterThan(0);
      // Scores should be descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('respects limit parameter', () => {
      const results = findTopMatches('wallet', faqDatabase, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('returns empty for empty query', () => {
      expect(findTopMatches('', faqDatabase)).toEqual([]);
    });

    it('returns empty for gibberish', () => {
      expect(findTopMatches('zzzzzzqqqq', faqDatabase)).toEqual([]);
    });
  });

  describe('faqDatabase integrity', () => {
    it('has at least 25 entries', () => {
      expect(faqDatabase.length).toBeGreaterThanOrEqual(25);
    });

    it('all entries have required fields', () => {
      for (const faq of faqDatabase) {
        expect(faq.id).toBeTruthy();
        expect(faq.category).toBeTruthy();
        expect(faq.keywords.length).toBeGreaterThan(0);
        expect(faq.question).toMatch(/^help\.faq\d+q$/);
        expect(faq.answer).toMatch(/^help\.faq\d+a$/);
      }
    });

    it('all IDs are unique', () => {
      const ids = faqDatabase.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('relatedIds reference valid IDs', () => {
      const ids = new Set(faqDatabase.map((f) => f.id));
      for (const faq of faqDatabase) {
        if (faq.relatedIds) {
          for (const relId of faq.relatedIds) {
            expect(ids.has(relId)).toBe(true);
          }
        }
      }
    });
  });
});
