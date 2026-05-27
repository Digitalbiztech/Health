import type { Request, Response, NextFunction } from 'express';
import { patientSignupSchema } from '../types/dto.js';
import * as userService from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

/**
 * POST /auth/patient/signup
 * Public endpoint — creates a new patient account.
 */
export async function patientSignup(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = patientSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new AppError(message, 400);
    }

    const { patient, session } = await userService.createPatient(parsed.data);

    const response: ApiResponse = {
      status: 'success',
      data: {
        patient: {
          id: patient.id,
          email: patient.email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
        },
        session: session
          ? {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in,
              token_type: session.token_type,
            }
          : null,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/staff/me
 * Protected — returns the current staff principal.
 */
export async function staffMe(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal || principal.accountType !== 'STAFF') {
      throw new AppError('Not a staff account', 401);
    }

    const response: ApiResponse = {
      status: 'success',
      data: {
        id: principal.id,
        email: principal.email,
        firstName: principal.firstName,
        lastName: principal.lastName,
        role: principal.role,
        accountType: principal.accountType,
        organizationId: principal.organizationId,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/patient/me
 * Protected — returns the current patient principal.
 */
export async function patientMe(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal || principal.accountType !== 'PATIENT') {
      throw new AppError('Not a patient account', 401);
    }

    const response: ApiResponse = {
      status: 'success',
      data: {
        id: principal.id,
        email: principal.email,
        firstName: principal.firstName,
        lastName: principal.lastName,
        dateOfBirth: principal.dateOfBirth,
        gender: principal.gender,
        accountType: principal.accountType,
        organizationId: principal.organizationId,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}
