import type { Request, Response, NextFunction } from 'express';
import { brandingService } from '../services/brandingService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

export async function getBrandingBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    if (!slug) {
      throw new AppError('Slug is required', 400);
    }
    const branding = await brandingService.getBrandingBySlug(slug);
    const response: ApiResponse = {
      status: 'success',
      data: branding,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getBrandingMe(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }
    if (!principal.organizationId) {
      throw new AppError('No organization linked to this account', 400);
    }
    const branding = await brandingService.getBrandingByOrgId(principal.organizationId);
    const response: ApiResponse = {
      status: 'success',
      data: branding,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function updateBrandingMe(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }
    if (!principal.organizationId) {
      throw new AppError('No organization linked to this account', 400);
    }
    // Only allow STAFF and ADMIN role to update branding
    if (principal.accountType !== 'STAFF' || principal.role !== 'ADMIN') {
      throw new AppError('Forbidden: Only organization admins can update branding', 403);
    }
    const branding = await brandingService.updateBranding(principal.organizationId, req.body);
    const response: ApiResponse = {
      status: 'success',
      data: branding,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}
