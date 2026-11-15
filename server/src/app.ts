import express from 'express';
import cors from 'cors';
import { CLIENT_ORIGIN, isDatabaseConfigured, NODE_ENV, PORT } from './config';
import { initDb } from './db/db';
import { ensureImagesBucket } from './lib/storage';
import { errorsMiddleware } from './middlewares/errorsMiddleware';
import { router as authRouter } from './features/auth/auth.router';
import { router as eventsRouter } from './features/events/event.router';
import { router as productsRouter } from './features/products/product.router';
import { router as clientsRouter } from './features/clients/client.router';
import { router as paymentsRouter } from './features/payments/payment.router';
import { router as uploadsRouter } from './features/uploads/upload.router';
import { router as savedEventsRouter } from './features/saved-events/savedEvent.router';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(','),
  }),
);

app.get('/', (_req, res) => {
  res.json({ name: 'After API' });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/products', productsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/saved-events', savedEventsRouter);

app.use(errorsMiddleware);

const start = (): void => {
  app.listen(PORT, async () => {
    console.info(`Server is running on http://localhost:${PORT}`);

    // The mock features work without a database, so a missing/broken DB is logged, not fatal
    if (!isDatabaseConfigured()) {
      console.warn('DB_* variables are not set: auth routes are disabled until server/.env is filled');
      return;
    }

    try {
      await initDb();
    } catch (error) {
      console.error('initDb failed', error);
    }

    // Never throws: a missing bucket is logged and only image uploads are affected
    await ensureImagesBucket();
  });
};

// Listen only when run directly (npm run dev/start). Tests and Vercel import the app instead.
if (require.main === module && NODE_ENV !== 'production') {
  start();
}

export default app;
