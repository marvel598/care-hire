import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';

const app = express();
app.disable('x-powered-by');

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'care-hire-backend' });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;
