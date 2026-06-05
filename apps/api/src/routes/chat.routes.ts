import { Router } from 'express';
import { requireAuth } from '../middleware/authGuard.js';
import { postChat } from '../controllers/chat.controller.js';

const router: Router = Router();

router.post('/', requireAuth, postChat);

export default router;
