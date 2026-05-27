import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';

import { env } from './config/env.js';
import { initializePassport } from './auth/passport.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import reportRoutes from './routes/report.routes.js';
import patientRoutes from './routes/patient.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import taskRoutes from './routes/task.routes.js';
import { extractionService, ExtractionServiceError } from './services/extractionService.js';

// Boot up BullMQ workers
import './queues/report.queue.js';
import './queues/extraction.queue.js';
import './queues/pdf.queue.js';

// ─── App Setup ───────────────────────────────────────────────

const app: Express = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Passport
initializePassport();
app.use(passport.initialize());

// ─── Routes ──────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/extraction', async (_req, res) => {
  try {
    const health = await extractionService.health();
    res.json({ status: 'ok', extraction: health });
  } catch (err) {
    const status = err instanceof ExtractionServiceError && err.status ? 502 : 503;
    res.status(status).json({
      status: 'unavailable',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use('/auth', authRoutes);
app.use('/reports', reportRoutes);
app.use('/patients', patientRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/tasks', taskRoutes);

// ─── Error Handling ──────────────────────────────────────────

app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.log(`🚀 API server running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});

export default app;
