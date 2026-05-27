import { Router } from 'express';
import { requireAuth } from '../middleware/authGuard.js';
import * as authController from '../controllers/auth.controller.js';

const router: Router = Router();

// ─── Public ──────────────────────────────────────────────────
router.post('/patient/signup', authController.patientSignup);

// ─── Protected ───────────────────────────────────────────────
router.get('/staff/me', requireAuth, authController.staffMe);
router.get('/patient/me', requireAuth, authController.patientMe);

export default router;
