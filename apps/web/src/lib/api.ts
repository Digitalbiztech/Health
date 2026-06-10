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

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatBiomarkerPayload {
  displayName: string;
  value: number | string;
  unit?: string;
  referenceRange?: string;
  status: string;
}

export interface ChatPatientPayload {
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
}

/**
 * Sends the chat history (plus biomarker/patient context) to the backend
 * AI assistant and returns the assistant's reply.
 */
export async function sendChatMessage(payload: {
  messages: ChatMessagePayload[];
  biomarkers?: ChatBiomarkerPayload[];
  patient?: ChatPatientPayload;
  patientId?: string;
  sessionId?: string;
}): Promise<{ reply: string; provider: string; sessionId: string }> {
  const res = await apiFetch<{ data: { reply: string; provider: string; sessionId: string } }>('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getChatHistory(patientId?: string, sessionId?: string): Promise<{ sessionId: string | null; messages: ChatMessagePayload[] }> {
  const params = new URLSearchParams();
  if (patientId) params.append('patientId', patientId);
  if (sessionId) params.append('sessionId', sessionId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<{ data: { sessionId: string | null; messages: ChatMessagePayload[] } }>(`/chat/history${query}`);
  return res.data;
}

/**
 * Requests the creation of a new chat session to start a fresh thread.
 */
export async function createChatSession(patientId?: string): Promise<{ sessionId: string }> {
  const res = await apiFetch<{ data: { sessionId: string } }>('/chat/session', {
    method: 'POST',
    body: JSON.stringify({ patientId }),
  });
  return res.data;
}

export interface ChatSessionPayload {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetches all past chat sessions for a patient.
 */
export async function getChatSessions(patientId?: string): Promise<ChatSessionPayload[]> {
  const query = patientId ? `?patientId=${patientId}` : '';
  const res = await apiFetch<{ data: ChatSessionPayload[] }>(`/chat/sessions${query}`);
  return res.data;
}

