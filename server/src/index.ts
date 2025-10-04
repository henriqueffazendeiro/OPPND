import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { connectMongo } from './db';
import eventsRouter from './routes/events';
import pixelRouter from './routes/pixel';
import sseRouter from './routes/sse';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', at: new Date().toISOString() });
});

app.use('/t/pixel', pixelRouter);
app.use('/events', eventsRouter);
app.use('/sse', sseRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Oppnd] Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3333);
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;

async function start() {
  if (!mongoUri) {
    console.error('[Oppnd] Missing Mongo connection string. Define MONGO_URI (or rely on Railway's MONGO_URL)');
    process.exit(1);
  }

  try {
    await connectMongo(mongoUri);
    const server = app.listen(port, () => {
      console.log(`[Oppnd] Server listening on port ${port}`);
    });
    process.on('SIGINT', () => {
      server.close(() => process.exit(0));
    });
  } catch (error) {
    console.error('[Oppnd] Failed to start server', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export default app;



