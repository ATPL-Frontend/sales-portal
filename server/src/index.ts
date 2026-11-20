import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import multer from 'multer';
import { env } from './config/env.js';
import { db } from './config/db.js';
import { HttpError } from './utils/errors.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { priceRouter } from './features/prices/routes.js';

const app = express();
app.disable('x-powered-by');
// Trust one hosting reverse proxy (cPanel/Passenger) for client IP rate limits.
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const api = express.Router();
api.get('/health', async (_req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok', service: 'cable-price-api' });
});
api.use('/auth', authRouter);
api.use('/admin', adminRouter);
api.use('/price-lists', priceRouter);
api.use((_req, _res, next) => next(new HttpError(404, 'API route not found')));

// Supports both Passenger configurations: one preserves /api and another
// strips the /api application URL prefix before handing requests to Node.
// Frontend requests remain /api/* in either case.
app.use('/api', api);
app.use('/', api);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (8 MB maximum)' : err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input', details: err.flatten().fieldErrors });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[API ERROR]', err);
  res.status(500).json({ error: 'An unexpected server error occurred' });
};
app.use(errorHandler);

// cPanel/Passenger supplies process.env.PORT. Locally the default is 4000.
app.listen(env.PORT, () => console.log(`Cable Price API listening on port ${env.PORT}`));
