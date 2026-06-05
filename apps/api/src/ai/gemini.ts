import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { ProviderError, type ChatMessage, type ChatProvider } from './types.js';

/**
 * Gemini chat provider — ported from services/gemini_service.py.
 * The Python used the newer google-genai SDK; here we use the installed
 * @google/generative-ai SDK with an equivalent flash model at temperature 0.4.
 */
class GeminiProvider implements ChatProvider {
  readonly name = 'gemini';
  private readonly modelName = 'gemini-1.5-flash';

  isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  async generateChatResponse(
    systemInstruction: string,
    history: ChatMessage[],
    userInput: string,
  ): Promise<string> {
    if (!env.GEMINI_API_KEY) {
      throw new ProviderError('NOT_CONFIGURED', 'GEMINI_API_KEY is not configured on the server.');
    }

    try {
      const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = client.getGenerativeModel({
        model: this.modelName,
        systemInstruction,
      });

      const chat = model.startChat({
        history: history.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })),
        generationConfig: { temperature: 0.4 },
      });

      const result = await chat.sendMessage(userInput);
      const text = result.response.text();
      if (!text) {
        throw new ProviderError('SERVICE_UNAVAILABLE', 'Gemini returned an empty response.');
      }
      return text;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new ProviderError('QUOTA_EXCEEDED', 'Gemini quota exceeded.');
      }
      if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
        throw new ProviderError('SERVICE_UNAVAILABLE', 'Gemini service unavailable.');
      }
      throw new ProviderError('SERVICE_UNAVAILABLE', `Error communicating with Gemini: ${msg}`);
    }
  }
}

export const geminiProvider = new GeminiProvider();
