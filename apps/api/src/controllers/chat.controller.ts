import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { generateChatReply, getLatestChatHistory, createNewSession, getChatSessions } from '../services/chatService.js';

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1, 'At least one message is required'),
  biomarkers: z
    .array(
      z.object({
        displayName: z.string(),
        value: z.union([z.number(), z.string()]),
        unit: z.string().optional(),
        referenceRange: z.string().optional(),
        status: z.string(),
      }),
    )
    .optional(),
  patient: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      gender: z.string().optional(),
      dateOfBirth: z.string().optional(),
    })
    .optional(),
  patientId: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * POST /chat
 * Protected — Generates a clinical-assistant reply grounded in the patient's
 * RAG history and biomarker context.
 */
export async function postChat(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || 'Invalid chat request', 400);
    }

    const { reply, provider, sessionId } = await generateChatReply({
      ...parsed.data,
      principal,
    });

    res.status(200).json({
      status: 'success',
      data: { reply, provider, sessionId },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /chat/history
 * Fetch the latest chat session and messages for a patient.
 */
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    let targetPatientId = req.query.patientId as string;
    if (principal.accountType === 'PATIENT') {
      targetPatientId = principal.id;
    }

    if (!targetPatientId) {
      throw new AppError('Patient ID is required', 400);
    }

    const history = await getLatestChatHistory(targetPatientId, principal);

    res.status(200).json({
      status: 'success',
      data: history,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /chat/session
 * Create a fresh chat session for a patient.
 */
export async function postNewSession(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    let targetPatientId = req.body.patientId as string;
    if (principal.accountType === 'PATIENT') {
      targetPatientId = principal.id;
    }

    if (!targetPatientId) {
      throw new AppError('Patient ID is required', 400);
    }

    const sessionId = await createNewSession(targetPatientId, principal);

    res.status(200).json({
      status: 'success',
      data: { sessionId },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /chat/sessions
 * Fetch all chat sessions for a patient.
 */
export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    let targetPatientId = req.query.patientId as string;
    if (principal.accountType === 'PATIENT') {
      targetPatientId = principal.id;
    }

    if (!targetPatientId) {
      throw new AppError('Patient ID is required', 400);
    }

    const sessions = await getChatSessions(targetPatientId, principal);

    res.status(200).json({
      status: 'success',
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
}
