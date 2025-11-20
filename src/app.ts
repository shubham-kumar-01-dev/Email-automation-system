import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import campaignRoutes from "./routes/campaignRoutes";
import leadRoutes from "./routes/leadRoutes";

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// DUMMY anuth middleware for development
// In a real app, you would have a proper auth system (e.g., Passport.js)
// This middleware adds a dummy user to each request
app.use((req: any, _res, next) => {
  req.user = { id: 1 }; // Dummy user with id 1
  next();
});


// Health Checks
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.send('Email Automation Service is running'));

// ✅ MOUNT ROUTES (Ye line missing thi)
// Ab jab bhi koi request /api/campaigns par aayegi, wo campaignRoutes par jayegi
app.use("/api/campaigns", campaignRoutes);
app.use("/api/leads", leadRoutes);

// Global Error Handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
});

export default app;