import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { generateChatReply } from '../services/chatService.js';

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
});

/**
 * POST /chat
 * Protected — Generates a clinical-assistant reply grounded in the patient's
 * biomarker context, falling back across the configured AI providers.
 */
export async function postChat(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || 'Invalid chat request', 400);
    }

    const { reply, provider } = await generateChatReply(parsed.data);

    res.status(200).json({
      status: 'success',
      data: { reply, provider },
    });
  } catch (err) {
    next(err);
  }
}
