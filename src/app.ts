import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import campaignRoutes from "./routes/campaignRoutes";

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Health Checks
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.send('Email Automation Service is running'));

// ✅ MOUNT ROUTES (Ye line missing thi)
// Ab jab bhi koi request /api/campaigns par aayegi, wo campaignRoutes par jayegi
app.use("/api/campaigns", campaignRoutes);

// Global Error Handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
});

export default app;