import { env } from '../config/env.js';
import { ProviderError, type ChatMessage, type ChatProvider } from './types.js';

/**
 * Mistral chat provider — ported from services/mistral_service.py.
 * Calls the Mistral chat completions REST API (mistral-medium-latest, temp 0.7).
 */
class MistralProvider implements ChatProvider {
  readonly name = 'mistral';
  private readonly apiBase = 'https://api.mistral.ai/v1';
  private readonly modelName = 'mistral-medium-latest';

  isConfigured(): boolean {
    return Boolean(env.MISTRAL_API_KEY);
  }

  async generateChatResponse(
    systemInstruction: string,
    history: ChatMessage[],
    userInput: string,
  ): Promise<string> {
    if (!env.MISTRAL_API_KEY) {
      throw new ProviderError('NOT_CONFIGURED', 'MISTRAL_API_KEY is not configured on the server.');
    }

    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: userInput },
    ];

    let response: Response;
    try {
      response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
    } catch (err) {
      throw new ProviderError(
        'SERVICE_UNAVAILABLE',
        `Error communicating with Mistral: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new ProviderError('QUOTA_EXCEEDED', 'Mistral quota exceeded.');
      }
      throw new ProviderError('SERVICE_UNAVAILABLE', `Mistral API returned status ${response.status}.`);
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new ProviderError('SERVICE_UNAVAILABLE', 'Mistral returned an empty response.');
    }
    return content;
  }
}

export const mistralProvider = new MistralProvider();
