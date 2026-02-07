import { API_URL } from '../config';

/**
 * Centralized API client that uses httpOnly cookies for authentication.
 * All requests include `credentials: 'include'` so the browser automatically
 * attaches the `mvga_auth` cookie — no manual Authorization headers needed.
 */
export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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
