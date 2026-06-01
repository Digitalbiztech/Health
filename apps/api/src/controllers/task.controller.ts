import { type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { TaskStatus, TaskPriority } from '@prisma/client';

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
 * GET /tasks
 * Protected — Lists the staff member's organization tasks, open items first,
 * then by priority (HIGH → LOW) and due date.
 */
export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);

    const tasks = await prisma.task.findMany({
      where: { organizationId },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { tasks },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /tasks
 * Protected — Creates a task owned by the staff member.
 */
export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);
    const principal = req.principal!;

    const { title, description, priority, dueDate, patientId } = req.body;

    if (!title) {
      throw new AppError('title is required', 400);
    }
    if (priority && !Object.values(TaskPriority).includes(priority)) {
      throw new AppError('Invalid task priority', 400);
    }

    // Validate optional patient linkage stays within the org
    if (patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: patientId, organizationId },
      });
      if (!patient) {
        throw new AppError('Patient not found in your organization', 404);
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority: priority || undefined,
        dueDate: dueDate ? new Date(dueDate) : null,
        patientId: patientId || null,
        organizationId,
        userId: principal.id,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({
      status: 'success',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /tasks/:id
 * Protected — Updates status, priority, or details of a task.
 */
export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);
    const { id } = req.params;

    const existing = await prisma.task.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new AppError('Task not found', 404);
    }

    const { title, description, status, priority, dueDate } = req.body;

    if (status && !Object.values(TaskStatus).includes(status)) {
      throw new AppError('Invalid task status', 400);
    }
    if (priority && !Object.values(TaskPriority).includes(priority)) {
      throw new AppError('Invalid task priority', 400);
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /tasks/:id
 * Protected — Removes a task from the org.
 */
export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await resolveStaffOrganization(req);
    const { id } = req.params;

    const existing = await prisma.task.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new AppError('Task not found', 404);
    }

    await prisma.task.delete({ where: { id } });

    res.status(200).json({
      status: 'success',
      data: { id },
    });
  } catch (err) {
    next(err);
  }
}
