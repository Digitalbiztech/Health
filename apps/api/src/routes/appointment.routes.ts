import { Router } from 'express';
import { requireAuth, requireAccountType } from '../middleware/authGuard.js';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from '../controllers/appointment.controller.js';

const router: Router = Router();

// All appointment endpoints require authentication and clinician STAFF account type
router.get('/', requireAuth, requireAccountType('STAFF'), getAppointments);
router.post('/', requireAuth, requireAccountType('STAFF'), createAppointment);
router.patch('/:id', requireAuth, requireAccountType('STAFF'), updateAppointment);
router.delete('/:id', requireAuth, requireAccountType('STAFF'), deleteAppointment);

export default router;
