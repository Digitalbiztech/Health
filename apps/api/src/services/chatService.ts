import { geminiProvider } from '../ai/gemini.js';
import { openaiProvider } from '../ai/gpt.js';
import { mistralProvider } from '../ai/mistral.js';
import { ProviderError, type ChatMessage, type ChatProvider } from '../ai/types.js';
import { AppError } from '../middleware/errorHandler.js';

export interface ChatBiomarker {
  displayName: string;
  value: number | string;
  unit?: string;
  referenceRange?: string;
  status: string;
}

export interface ChatPatientContext {
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  biomarkers?: ChatBiomarker[];
  patient?: ChatPatientContext;
}

// Provider preference order; the orchestrator falls back through these on
// QUOTA_EXCEEDED / SERVICE_UNAVAILABLE / NOT_CONFIGURED.
const PROVIDERS: ChatProvider[] = [geminiProvider, openaiProvider, mistralProvider];

const BASE_SYSTEM_PROMPT = `You are Auriem's clinical diagnostics assistant, helping a patient understand their laboratory bloodwork.

RULES:
1. Be professional, clear, and supportive. Use plain language a non-clinician can understand.
2. Ground every statement in the biomarker context provided below. Do not invent values you were not given.
3. Do NOT diagnose specific diseases or prescribe medication. Frame guidance as "topics to discuss with your healthcare provider."
4. When relevant, offer evidence-based lifestyle, dietary, and follow-up testing suggestions.
5. Format responses in concise Markdown (short paragraphs, bullet points, or numbered steps where helpful).`;

function buildSystemPrompt(req: ChatRequest): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

  if (req.patient) {
    const { firstName, gender, dateOfBirth } = req.patient;
    const details: string[] = [];
    if (firstName) details.push(`First name: ${firstName}`);
    if (gender) details.push(`Gender: ${gender}`);
    if (dateOfBirth) details.push(`Date of birth: ${dateOfBirth}`);
    if (details.length) {
      sections.push(`PATIENT CONTEXT:\n${details.join('\n')}`);
    }
  }

  if (req.biomarkers?.length) {
    const lines = req.biomarkers.map((b) => {
      const unit = b.unit ? ` ${b.unit}` : '';
      const ref = b.referenceRange ? ` (Ref: ${b.referenceRange})` : '';
      return `- ${b.displayName}: ${b.value}${unit}${ref} — ${b.status}`;
    });
    sections.push(`BIOMARKER RESULTS:\n${lines.join('\n')}`);
  } else {
    sections.push('BIOMARKER RESULTS:\nNo structured biomarker data was provided for this conversation.');
  }

  return sections.join('\n\n');
}

/**
 * Orchestrates a chat completion across the available providers, falling back
 * to the next provider whenever one is unconfigured, rate-limited, or down.
 */
export async function generateChatReply(req: ChatRequest): Promise<{ reply: string; provider: string }> {
  if (!req.messages.length) {
    throw new AppError('At least one message is required', 400);
  }

  const last = req.messages[req.messages.length - 1];
  if (last.role !== 'user') {
    throw new AppError('The last message must be from the user', 400);
  }

  const systemPrompt = buildSystemPrompt(req);
  const history = req.messages.slice(0, -1);
  const userInput = last.content;

  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.isConfigured()) {
      errors.push(`${provider.name}: not configured`);
      continue;
    }
    try {
      const reply = await provider.generateChatResponse(systemPrompt, history, userInput);
      return { reply, provider: provider.name };
    } catch (err) {
      if (err instanceof ProviderError) {
        errors.push(`${provider.name}: ${err.code}`);
        continue;
      }
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new AppError(
    `All chat providers are unavailable (${errors.join('; ')}).`,
    503,
  );
}
