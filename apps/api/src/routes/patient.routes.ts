import { Router } from 'express';
import { requireAuth, requireAccountType } from '../middleware/authGuard.js';
import { getPatients, createPatientForStaff, getPatientStats } from '../controllers/patient.controller.js';

const router: Router = Router();

// All patient endpoints require authentication and clinician STAFF account type
router.get('/', requireAuth, requireAccountType('STAFF'), getPatients);
router.get('/stats', requireAuth, requireAccountType('STAFF'), getPatientStats);
router.post('/', requireAuth, requireAccountType('STAFF'), createPatientForStaff);

export default router;
