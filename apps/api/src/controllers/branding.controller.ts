import type { Request, Response, NextFunction } from 'express';
import { brandingService } from '../services/brandingService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ApiResponse } from '../types/index.js';
import { SupabaseStorageService } from '../storage/supabase.storage.js';

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

const LOGO_SLOT_MAP: Record<string, string> = {
  main: 'logoMainUrl',
  icon: 'logoIconUrl',
  letterform: 'logoLetterformUrl',
  favicon: 'faviconUrl',
};

export async function uploadBrandingLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }
    if (!principal.organizationId) {
      throw new AppError('No organization linked to this account', 400);
    }
    if (principal.accountType !== 'STAFF' || principal.role !== 'ADMIN') {
      throw new AppError('Forbidden: Only organization admins can upload logos', 403);
    }

    const file = req.file;
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    const slot = req.body.slot as string;
    if (!slot || !LOGO_SLOT_MAP[slot]) {
      throw new AppError(`Invalid slot. Must be one of: ${Object.keys(LOGO_SLOT_MAP).join(', ')}`, 400);
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const filePath = `${principal.organizationId}/${slot}-${Date.now()}.${ext}`;

    const publicUrl = await SupabaseStorageService.uploadFile(
      'branding-assets',
      filePath,
      file.buffer,
      file.mimetype,
    );

    // Update the branding record with the new logo URL
    const dbField = LOGO_SLOT_MAP[slot];
    const branding = await brandingService.updateBranding(principal.organizationId, {
      [dbField]: publicUrl,
    });

    const response: ApiResponse = {
      status: 'success',
      data: branding,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}
