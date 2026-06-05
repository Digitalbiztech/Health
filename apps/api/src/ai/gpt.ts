import OpenAI from 'openai';
import { env } from '../config/env.js';
import { ProviderError, type ChatMessage, type ChatProvider } from './types.js';

/**
 * OpenAI chat provider — ported from services/openai_service.py.
 * Uses the model from OPENAI_MODEL (default gpt-4o-mini) at temperature 0.4.
 */
class OpenAIProvider implements ChatProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async generateChatResponse(
    systemInstruction: string,
    history: ChatMessage[],
    userInput: string,
  ): Promise<string> {
    if (!env.OPENAI_API_KEY) {
      throw new ProviderError('NOT_CONFIGURED', 'OPENAI_API_KEY is not configured on the server.');
    }

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: userInput },
    ];

    try {
      const response = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ProviderError('SERVICE_UNAVAILABLE', 'OpenAI returned an empty response.');
      }
      return content;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const status = (err as { status?: number }).status;
      if (status === 429) {
        throw new ProviderError('QUOTA_EXCEEDED', 'OpenAI quota exceeded.');
      }
      if (status === 503) {
        throw new ProviderError('SERVICE_UNAVAILABLE', 'OpenAI service unavailable.');
      }
      throw new ProviderError(
        'SERVICE_UNAVAILABLE',
        `Error communicating with OpenAI: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export const openaiProvider = new OpenAIProvider();
