import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const BYPASS_AUTH = true; // Toggle to false to restore Supabase authentication

/**
 * Authenticated fetch wrapper — injects the Supabase access token
 * into the Authorization header for backend API calls.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token: string | undefined;

  if (BYPASS_AUTH) {
    token = 'mock-access-token';
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  }

  const preferredAccountType = localStorage.getItem('preferredAccountType') || 'STAFF';
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(BYPASS_AUTH ? { 'x-mock-account-type': preferredAccountType } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.message || `Request failed: ${response.status}`,
      response.status,
      body,
    );
  }

  return response.json();
}

/**
 * Typed API error with status code and response body.
 */
export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
