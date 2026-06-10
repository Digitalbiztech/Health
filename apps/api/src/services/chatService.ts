import { geminiProvider } from '../ai/gemini.js';
import { openaiProvider } from '../ai/gpt.js';
import { mistralProvider } from '../ai/mistral.js';
import { ProviderError, type ChatMessage as ProviderChatMessage, type ChatProvider } from '../ai/types.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { ragService } from './ragService.js';
import type { AuthenticatedPrincipal } from '../types/index.js';

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
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  biomarkers?: ChatBiomarker[];
  patient?: ChatPatientContext;
  patientId?: string;
  sessionId?: string;
  principal: AuthenticatedPrincipal;
}

const PROVIDERS: ChatProvider[] = [geminiProvider, openaiProvider, mistralProvider];

const BASE_SYSTEM_PROMPT = `You are Auriem's clinical diagnostics assistant, helping a patient understand their laboratory bloodwork.

RULES:
1. Be professional, clear, and supportive. Use plain language a non-clinician can understand.
2. Ground every statement in the biomarker context provided below. Do not invent values you were not given.
3. Do NOT diagnose specific diseases or prescribe medication. Frame guidance as "topics to discuss with your healthcare provider."
4. When relevant, offer evidence-based lifestyle, dietary, and follow-up testing suggestions.
5. Format responses in concise Markdown (short paragraphs, bullet points, or numbered steps where helpful).`;

const DOCTOR_BASE_SYSTEM_PROMPT = `You are Auriem's clinical diagnostic co-pilot, assisting a healthcare professional (physician/clinician) in reviewing laboratory bloodwork history and medical guidelines.

RULES:
1. Speak as a peer to a clinician: Use precise medical terminology, clinical reasoning, and scientific concepts. Do not simplify or patronize.
2. Ground every response in the patient's longitudinal history, guidelines, and current values.
3. Focus on clinical interpretation: discuss differential diagnoses, potential physiological mechanisms, and recommended clinical next steps (e.g. specific follow-up panels, imaging, or specialist consultation).
4. Provide structured, dense, and objective insights using Markdown.`;

function buildSystemPrompt(req: Omit<ChatRequest, 'principal'>, userRole: 'doctor' | 'patient'): string {
  const basePrompt = userRole === 'doctor' ? DOCTOR_BASE_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;
  const sections: string[] = [basePrompt];

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
 * Helper to ensure we have a valid organization ID.
 */
async function getFallbackOrganizationId(): Promise<string> {
  const firstOrg = await prisma.organization.findFirst();
  if (firstOrg) return firstOrg.id;

  const newOrg = await prisma.organization.create({
    data: {
      name: 'Default Organization',
      slug: 'default-organization',
    },
  });
  return newOrg.id;
}

/**
 * Gets the latest active chat session for a patient, or creates a new one.
 */
export async function getOrCreateActiveSession(
  patientId: string,
  principal: AuthenticatedPrincipal
): Promise<string> {
  const activeSession = await prisma.chatSession.findFirst({
    where: { patientId },
    orderBy: { updatedAt: 'desc' },
  });

  if (activeSession) {
    return activeSession.id;
  }

  const organizationId = principal.organizationId || (await getFallbackOrganizationId());
  const newSession = await prisma.chatSession.create({
    data: {
      title: `Consultation - ${new Date().toLocaleDateString()}`,
      patientId,
      organizationId,
      userId: principal.accountType === 'STAFF' ? principal.id : null,
    },
  });

  return newSession.id;
}

/**
 * Creates a brand new chat session explicitly.
 */
export async function createNewSession(
  patientId: string,
  principal: AuthenticatedPrincipal
): Promise<string> {
  const organizationId = principal.organizationId || (await getFallbackOrganizationId());
  const newSession = await prisma.chatSession.create({
    data: {
      title: `Consultation - ${new Date().toLocaleDateString()}`,
      patientId,
      organizationId,
      userId: principal.accountType === 'STAFF' ? principal.id : null,
    },
  });
  return newSession.id;
}

/**
 * Fetches the complete message history for a patient's latest active session.
 */
export async function getLatestChatHistory(patientId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { patientId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!session) {
    return { sessionId: null, messages: [] };
  }

  return {
    sessionId: session.id,
    messages: session.messages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    })),
  };
}

/**
 * Orchestrates a chat completion. Tries RAG first; falls back to LLM provider chain on error.
 * Saves messages to database for persistent history.
 */
export async function generateChatReply(req: ChatRequest): Promise<{ reply: string; provider: string; sessionId: string }> {
  if (!req.messages.length) {
    throw new AppError('At least one message is required', 400);
  }

  const lastMessage = req.messages[req.messages.length - 1];
  if (lastMessage.role !== 'user') {
    throw new AppError('The last message must be from the user', 400);
  }

  const userQuery = lastMessage.content;

  // 1. Resolve patient ID
  let targetPatientId = req.patientId;
  if (req.principal.accountType === 'PATIENT') {
    targetPatientId = req.principal.id;
  }

  if (!targetPatientId) {
    throw new AppError('Patient ID is required to route chat messages', 400);
  }

  // 2. Resolve or create chat session
  let sessionId = req.sessionId;
  if (!sessionId) {
    sessionId = await getOrCreateActiveSession(targetPatientId, req.principal);
  }

  // 3. Save the new user message to the database
  await prisma.chatMessage.create({
    data: {
      role: 'USER',
      content: userQuery,
      sessionId: sessionId,
    },
  });

  // Update session's updatedAt time
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  // 4. Retrieve complete message history for context
  const allDbMessages = await prisma.chatMessage.findMany({
    where: { sessionId: sessionId },
    orderBy: { createdAt: 'asc' },
  });

  const messageHistory = allDbMessages.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }));

  const userRole = req.principal.accountType === 'STAFF' ? 'doctor' : 'patient';

  // 5. Try Retrieval-Augmented Generation (RAG)
  try {
    console.log(`[ChatService] Querying RAG service for patient: ${targetPatientId}, session: ${sessionId} (role: ${userRole})`);
    const ragResult = await ragService.chat({
      patient_id: targetPatientId,
      messages: messageHistory.slice(0, -1), // History leading up to current query
      user_input: userQuery,
      biomarkers: req.biomarkers ? req.biomarkers.map((b) => ({
        displayName: b.displayName,
        value: b.value,
        unit: b.unit,
        referenceRange: b.referenceRange,
        status: b.status,
      })) : null,
      user_role: userRole,
    });

    // Save RAG response
    await prisma.chatMessage.create({
      data: {
        role: 'ASSISTANT',
        content: ragResult.reply,
        sessionId: sessionId,
      },
    });

    return {
      reply: ragResult.reply,
      provider: `rag-${ragResult.provider}`,
      sessionId: sessionId,
    };
  } catch (ragErr) {
    console.warn('[ChatService] RAG service failed, falling back to standard LLM providers:', ragErr);

    // 6. Fallback to standard provider chain (Gemini -> OpenAI -> Mistral)
    const systemPrompt = buildSystemPrompt(req, userRole);
    const historyForProvider: ProviderChatMessage[] = messageHistory.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));


    const errors: string[] = [];

    for (const provider of PROVIDERS) {
      if (!provider.isConfigured()) {
        errors.push(`${provider.name}: not configured`);
        continue;
      }
      try {
        const reply = await provider.generateChatResponse(systemPrompt, historyForProvider, userQuery);

        // Save fallback response
        await prisma.chatMessage.create({
          data: {
            role: 'ASSISTANT',
            content: reply,
            sessionId: sessionId,
          },
        });

        return {
          reply,
          provider: provider.name,
          sessionId: sessionId,
        };
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
}
