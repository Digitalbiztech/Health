import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/authGuard.js';
import * as brandingController from '../controllers/branding.controller.js';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public route to resolve branding by slug
router.get('/:slug', brandingController.getBrandingBySlug);

// Protected routes
router.get('/me', requireAuth, brandingController.getBrandingMe);
router.put('/me', requireAuth, brandingController.updateBrandingMe);
router.post('/me/logo', requireAuth, upload.single('file'), brandingController.uploadBrandingLogo);

export default router;
