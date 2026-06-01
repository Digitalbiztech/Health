import { type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AppointmentStatus } from '@prisma/client';

/**
 * Resolve the organization id for a STAFF principal, lazily creating a default
 * organization and back-filling the user record when none is set.
 * Mirrors the pattern used in patient.controller.ts.
 */
async function resolveStaffOrganization(req: Request): Promise<string> {
  const principal = req.principal;
  if (!principal || principal.accountType !== 'STAFF') {
    throw new AppError('Unauthorized: Clinician access required', 401);
  }

  let organizationId = principal.organizationId;
  if (!organizationId) {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: 'Auriem Suite', slug: 'auriem-suite' },
      });
    }
    organizationId = org.id;
    await prisma.user.update({
      where: { id: principal.id },
      data: { organizationId },
    });
  }

  return organizationId;
}

/**
 * GET /appointments
 * Protected — Lists appointments for the staff member's organization.
 * Optional ?from & ?to ISO date strings narrow the startTime window.
 */
export async function getAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);

    const { from, to } = req.query;
    const startTimeFilter: { gte?: Date; lte?: Date } = {};
    if (typeof from === 'string' && from) startTimeFilter.gte = new Date(from);
    if (typeof to === 'string' && to) startTimeFilter.lte = new Date(to);

    const appointments = await prisma.appointment.findMany({
      where: {
        organizationId,
        ...(startTimeFilter.gte || startTimeFilter.lte ? { startTime: startTimeFilter } : {}),
      },
      orderBy: { startTime: 'asc' },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, gender: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { appointments },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /appointments
 * Protected — Creates a new appointment for a patient in the org.
 */
export async function createAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);
    const principal = req.principal!;

    const { title, notes, startTime, endTime, patientId } = req.body;

    if (!title || !startTime || !patientId) {
      throw new AppError('title, startTime and patientId are required', 400);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId },
    });
    if (!patient) {
      throw new AppError('Patient not found in your organization', 404);
    }

    const appointment = await prisma.appointment.create({
      data: {
        title,
        notes: notes || null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        patientId,
        organizationId,
        userId: principal.id,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, gender: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({
      status: 'success',
      data: { appointment },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /appointments/:id
 * Protected — Updates status, schedule, or details of an appointment.
 */
export async function updateAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);
    const { id } = req.params;

    const existing = await prisma.appointment.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new AppError('Appointment not found', 404);
    }

    const { title, notes, startTime, endTime, status } = req.body;

    if (status && !Object.values(AppointmentStatus).includes(status)) {
      throw new AppError('Invalid appointment status', 400);
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(startTime !== undefined ? { startTime: new Date(startTime) } : {}),
        ...(endTime !== undefined ? { endTime: endTime ? new Date(endTime) : null } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, gender: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { appointment },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /appointments/:id
 * Protected — Removes an appointment from the org.
 */
export async function deleteAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);
    const { id } = req.params;

    const existing = await prisma.appointment.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new AppError('Appointment not found', 404);
    }

    await prisma.appointment.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      data: { id },
    });
  } catch (err) {
    next(err);
  }
}
