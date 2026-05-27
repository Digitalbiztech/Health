import { Router } from 'express';
import multer from 'multer';
import { uploadReport, getUploads, getReportByUploadId } from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/authGuard.js';

const router: Router = Router();

// Configure multer to store uploaded files in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// All report routes require authentication
router.post('/upload', requireAuth, upload.single('file'), uploadReport);
router.get('/uploads', requireAuth, getUploads);
router.get('/upload/:uploadId', requireAuth, getReportByUploadId);

export default router;
