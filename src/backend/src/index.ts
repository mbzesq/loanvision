import './config'; // This must be the absolute first line.
console.log(`[STARTUP] DATABASE_URL seen by Node.js: ${process.env.DATABASE_URL}`);
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import uploadRouter from './routes/upload';
import loansRouter from './routes/loans';
import portfolioRouter from './routes/portfolio';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';
import betaAccessRouter from './routes/betaAccess';
import solRouter from './routes/solRoutes';
import foreclosureRouter from './routes/foreclosureRoutes';
import adminRouter from './routes/adminRoutes';
import simpleAdminRouter from './routes/simpleAdminRoutes';
import diagnosticsRouter from './routes/diagnostics';
import pool from './db';
import { getForeclosureTimeline } from './services/foreclosureService';
import { seedSuperUser } from './scripts/createSuperUser';
import { initializeSOLScheduler } from './services/SOLScheduler';
import { initializeChatRetentionService } from './services/chatRetentionService';
import { NotificationEngine } from './services/notificationEngine';
import { WebSocketServer } from './services/websocketServer';
import { setWSServerInstance } from './services/wsServerInstance';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Notification Engine and WebSocket Server
console.log('Initializing Notification Engine...');
const notificationEngine = new NotificationEngine(pool);
console.log('Initializing WebSocket server...');
const wsServer = new WebSocketServer(server, notificationEngine);
setWSServerInstance(wsServer);
console.log('WebSocket server initialized successfully');

// This entire block should be added right after const app = express();
const allowedOrigins = [
  'https://nplvision.com',
  'https://www.nplvision.com',
  'http://localhost:3001', // Development frontend
  'http://localhost:5173', // Vite development server
  'http://127.0.0.1:5173',  // Alternative localhost
  'http://localhost:3000', // Same-origin requests
  'http://127.0.0.1:3000'  // Alternative same-origin
];

// Add any additional origins from environment variables
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...additionalOrigins);
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    console.log(`[CORS] Request from origin: ${origin}`);
    console.log(`[CORS] Allowed origins:`, allowedOrigins);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log(`[CORS] No origin - allowing request`);
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from origin: ${origin}`;
      console.log(`[CORS] REJECTED: ${msg}`);
      return callback(new Error(msg), false);
    }
    
    console.log(`[CORS] ALLOWED: ${origin}`);
    return callback(null, true);
  },
  credentials: true // Allow cookies and authorization headers
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
      timelineData: timeline,
      websocket: {
        enabled: true,
        path: '/ws',
        status: 'running'
      },
      environment: process.env.NODE_ENV || 'development'
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
app.use('/api', betaAccessRouter);
app.use('/api', uploadRouter);
app.use('/api', loansRouter);
app.use('/api', portfolioRouter);
app.use('/api', reportsRouter);
app.use('/api/sol', solRouter);
app.use('/api/foreclosure', foreclosureRouter);
app.use('/api/admin', adminRouter);
app.use('/api/simple-admin', simpleAdminRouter);
app.use('/api/diagnostics', diagnosticsRouter);

// Document Analysis Routes (New OCR-based system)
import documentAnalysisRouter from './routes/documentAnalysis';
app.use('/api/v2/loans', documentAnalysisRouter);

// Inbox Routes
import inboxRouter from './routes/inbox';
app.use('/api/inbox', inboxRouter);

// Organization Routes
import organizationRouter from './routes/organizationRoutes';
app.use('/api/organizations', organizationRouter);

// Chat Routes
import chatRouter from './routes/chat';
app.use('/api/chat', chatRouter);

// AI Assistant Routes
import aiAssistantRouter from './routes/aiAssistant';
import { createAIAssistantRAGRouter } from './routes/aiAssistantRAG';
import { loadAIConfig, getAIMode } from './config/aiConfig';

// Load AI configuration
const aiConfig = loadAIConfig();
console.log(`🤖 AI Assistant mode: ${getAIMode()}`);

if (aiConfig.useRAG) {
  // Use RAG-based AI assistant for efficient token usage
  app.use('/api/ai', createAIAssistantRAGRouter(pool));
  console.log('✅ RAG-based AI Assistant enabled');
} else {
  // Use traditional AI assistant
  app.use('/api/ai', aiAssistantRouter);
  console.log('📊 Traditional AI Assistant enabled');
}

// Notifications will be handled via WebSocket and existing inbox routes


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

  // Initialize SOL Scheduler
  console.log('[SOL] Initializing Statute of Limitations scheduler...');
  try {
    initializeSOLScheduler(pool);
    console.log('[SOL] Scheduler initialized successfully');
  } catch (error) {
    console.error('[SOL] Failed to initialize scheduler:', error);
  }

  // Initialize Chat Retention Service
  console.log('[Chat] Initializing chat message retention service...');
  try {
    initializeChatRetentionService(pool, {
      retentionHours: 24, // 24-hour retention policy
      cleanupIntervalHours: 1 // Check every hour
    });
    console.log('[Chat] Retention service initialized successfully (24-hour policy)');
  } catch (error) {
    console.error('[Chat] Failed to initialize retention service:', error);
  }

  // Start Notification Engine
  console.log('[Notifications] Starting Notification Engine...');
  try {
    notificationEngine.start();
    console.log('[Notifications] Notification Engine started successfully');
  } catch (error) {
    console.error('[Notifications] Failed to start Notification Engine:', error);
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  });
};

startServer();