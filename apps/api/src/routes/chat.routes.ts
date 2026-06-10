import { Router } from 'express';
import { requireAuth } from '../middleware/authGuard.js';
import { postChat, getHistory, postNewSession, getSessions } from '../controllers/chat.controller.js';

const router: Router = Router();

router.post('/', requireAuth, postChat);
router.get('/history', requireAuth, getHistory);
router.post('/session', requireAuth, postNewSession);
router.get('/sessions', requireAuth, getSessions);

export default router;
