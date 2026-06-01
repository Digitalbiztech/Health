import { Router } from 'express';
import { requireAuth, requireAccountType } from '../middleware/authGuard.js';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/task.controller.js';

const router: Router = Router();

// All task endpoints require authentication and clinician STAFF account type
router.get('/', requireAuth, requireAccountType('STAFF'), getTasks);
router.post('/', requireAuth, requireAccountType('STAFF'), createTask);
router.patch('/:id', requireAuth, requireAccountType('STAFF'), updateTask);
router.delete('/:id', requireAuth, requireAccountType('STAFF'), deleteTask);

export default router;
