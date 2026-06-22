import { Router } from 'express';
import { requireAuth } from '../middleware/authGuard.js';
import * as brandingController from '../controllers/branding.controller.js';

const router: Router = Router();

// Public route to resolve branding by slug
router.get('/:slug', brandingController.getBrandingBySlug);

// Protected routes
router.get('/me', requireAuth, brandingController.getBrandingMe);
router.put('/me', requireAuth, brandingController.updateBrandingMe);

export default router;
