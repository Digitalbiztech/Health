import { env } from '../config/env.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatBiomarker {
  displayName: string;
  value: any;
  unit?: string | null;
  referenceRange?: string | null;
  status: string;
}

export interface RagChatRequest {
  patient_id: string;
  messages: ChatMessage[];
  user_input: string;
  biomarkers?: ChatBiomarker[] | null;
  user_role?: 'doctor' | 'patient';
  organization_id?: string | null;
}

export interface RagChatResponse {
  reply: string;
  provider: string;
}

export class RagServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'RagServiceError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.EXTRACTION_SERVICE_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.EXTRACTION_SERVICE_URL}/rag${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(env.EXTRACTION_SERVICE_SECRET ? { 'X-Service-Secret': env.EXTRACTION_SERVICE_SECRET } : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new RagServiceError(
        `RAG service ${path} returned ${res.status}: ${body || res.statusText}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof RagServiceError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new RagServiceError(
        `RAG service ${path} timed out after ${env.EXTRACTION_SERVICE_TIMEOUT_MS}ms`,
      );
    }
    throw new RagServiceError(
      `Failed to reach RAG service: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const ragService = {
  async chat(params: RagChatRequest): Promise<RagChatResponse> {
    return request<RagChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async health(): Promise<any> {
    return request<any>('/health', { method: 'GET' });
  },
};
