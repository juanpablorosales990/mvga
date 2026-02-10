import { FaqEntry } from './faqDatabase';

/**
 * Normalize a string for matching: lowercase, strip accents, trim.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Score a FAQ entry against a user query.
 * Returns 0-100. Higher = better match.
 */
function scoreFaq(query: string, faq: FaqEntry): number {
  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);

  if (queryWords.length === 0) return 0;

  let matchedKeywords = 0;
  let totalWeight = 0;

  for (const keyword of faq.keywords) {
    const normalizedKeyword = normalize(keyword);
    totalWeight++;

    // Exact word match in query
    if (normalizedQuery.includes(normalizedKeyword)) {
      matchedKeywords += normalizedKeyword.length > 3 ? 2 : 1; // Longer keywords score more
    }
    // Check if any query word starts with keyword or vice versa
    else if (
      queryWords.some((w) => w.startsWith(normalizedKeyword) || normalizedKeyword.startsWith(w))
    ) {
      matchedKeywords += 0.5;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.min(100, (matchedKeywords / Math.max(queryWords.length, 1)) * 50);
}

const MATCH_THRESHOLD = 15;

export interface MatchResult {
  faq: FaqEntry;
  score: number;
}

/**
 * Find the best FAQ match for a user query.
 * Returns null if no match exceeds threshold.
 */
export function findBestMatch(query: string, faqs: FaqEntry[]): MatchResult | null {
  if (!query.trim() || query.trim().length < 2) return null;

  let best: MatchResult | null = null;

  for (const faq of faqs) {
    const score = scoreFaq(query, faq);
    if (score > MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { faq, score };
    }
  }

  return best;
}

/**
 * Find top N matches (for "related questions" suggestions).
 */
export function findTopMatches(query: string, faqs: FaqEntry[], limit = 3): MatchResult[] {
  if (!query.trim() || query.trim().length < 2) return [];

  const scored = faqs
    .map((faq) => ({ faq, score: scoreFaq(query, faq) }))
    .filter((r) => r.score > MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
