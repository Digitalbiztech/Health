export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Signals raised by chat providers so the orchestrator can fall back to the
 * next provider instead of surfacing the error. Mirrors the QUOTA_EXCEEDED /
 * SERVICE_UNAVAILABLE sentinels used by the original Python services.
 */
export type ProviderErrorCode = 'QUOTA_EXCEEDED' | 'SERVICE_UNAVAILABLE' | 'NOT_CONFIGURED';

export class ProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ProviderError';
  }
}

export interface ChatProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateChatResponse(
    systemInstruction: string,
    history: ChatMessage[],
    userInput: string,
  ): Promise<string>;
}
