import './config'; // This must be the absolute first line.
console.log(`[STARTUP] DATABASE_URL seen by Node.js: ${process.env.DATABASE_URL}`);
import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload';
import loansRouter from './routes/loans';
import portfolioRouter from './routes/portfolio';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';
import pool from './db';
import { getForeclosureTimeline } from './services/foreclosureService';
import { seedSuperUser } from './scripts/createSuperUser';

const app = express();
const PORT = process.env.PORT || 3000;

// This entire block should be added right after const app = express();
const allowedOrigins = ['https://loanvision-frontend.onrender.com'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};

app.use(cors(corsOptions)); // This must be the first middleware
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    console.log('[Debug] Testing foreclosure timeline for loan 0000359811...');
    const timeline = await getForeclosureTimeline('0000359811');
    res.json({
      message: "This is a temporary test endpoint.",
      loanId: "0000359811",
      timelineData: timeline
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    res.status(500).json({ error: "Test endpoint failed", details: errorMessage });
  }
});

app.use('/api/auth', authRouter);
app.use('/api', uploadRouter);
app.use('/api', loansRouter);
app.use('/api', portfolioRouter);
app.use('/api', reportsRouter);

// Add this entire async block right before app.listen

const runInitialSeed = async () => {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(res.rows[0].count, 10) === 0) {
      console.log('[Seed] No users found. Seeding super user...');
      await seedSuperUser();
    } else {
      console.log('[Seed] Database already contains users. Skipping seed.');
    }
  } catch (error) {
    console.error('[Seed] Error during initial seed check:', error);
  }
};

const runDiagnostics = async () => {
  try {
    console.log('[Diagnostics] Running startup database checks...');

    // Check row count
    const countResult = await pool.query('SELECT COUNT(*) FROM daily_metrics_current;');
    console.log(`[Diagnostics] Row count in daily_metrics_current: ${countResult.rows[0].count}`);

    // Check a sample of loan_ids
    if (countResult.rows[0].count > 0) {
      const sampleResult = await pool.query('SELECT loan_id FROM daily_metrics_current LIMIT 5;');
      console.log('[Diagnostics] Sample loan_ids:', sampleResult.rows.map(r => r.loan_id));
    }

    console.log('[Diagnostics] Database checks complete.');
  } catch (error) {
    console.error('[Diagnostics] Error during startup database checks:', error);
  }
};

const startServer = async () => {
  // Run the one-time seeding logic before starting the server
  await runInitialSeed();
  await runDiagnostics();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();