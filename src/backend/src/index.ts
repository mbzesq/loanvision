import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload';
import loansRouter from './routes/loans';
import portfolioRouter from './routes/portfolio';
import reportsRouter from './routes/reports';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = ['https://loanvision-frontend.onrender.com'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // The 'origin' can be 'undefined' for server-to-server requests or browser extensions.
    // We can allow these or block them based on our security needs.
    // For now, we'll proceed if there's no origin or if it's in our allowed list.
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`CORS error: Origin ${origin} not allowed.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // This allows cookies to be sent
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions)); // CORS MUST BE THE FIRST MIDDLEWARE
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', uploadRouter);
app.use('/api', loansRouter);
app.use('/api', portfolioRouter);
app.use('/api', reportsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});