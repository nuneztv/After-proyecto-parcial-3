// `npm run db:init`: creates the tables once. Needed for serverless deploys (Vercel),
// where app.ts never calls listen() and therefore never runs initDb on startup.
import { initDb, pool } from './db';

const run = async (): Promise<void> => {
  try {
    await initDb();
    console.info('Database schema is up to date');
  } finally {
    await pool.end();
  }
};

run().catch((error: unknown) => {
  console.error('initDb failed', error);
  process.exit(1);
});
