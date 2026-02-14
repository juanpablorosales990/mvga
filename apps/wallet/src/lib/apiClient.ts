import { API_URL } from '../config';

/** Parse API error response into a user-friendly message */
function parseApiError(status: number, body: string): string {
  // Try to extract message from JSON response
  try {
    const json = JSON.parse(body);
    if (json.message) {
      return Array.isArray(json.message) ? json.message[0] : json.message;
    }
  } catch {
    // Not JSON — use status-based fallback
  }

  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Session expired. Please reconnect your wallet.';
    case 403:
      return 'You do not have permission for this action.';
    case 404:
      return 'Not found.';
    case 409:
      return 'This action conflicts with existing data.';
    case 429:
      return 'Too many requests. Please wait a moment.';
    default:
      return status >= 500 ? 'Server error. Please try again later.' : 'Something went wrong.';
  }
}

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
    throw new Error(parseApiError(res.status, body));
  }
  return res.json();
}
