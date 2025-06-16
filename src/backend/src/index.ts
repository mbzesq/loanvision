import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload';
import loansRouter from './routes/loans';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', uploadRouter);
app.use('/api', loansRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});