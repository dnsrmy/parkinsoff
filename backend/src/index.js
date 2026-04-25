import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import { handleVoiceAnalysis } from './routes/voice.js';
import { handlePatakaAnalysis } from './routes/pataka.js';
import { handleReadingAnalysis } from './routes/reading.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] }));
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/analyze', analyzeRouter);
app.post('/api/voice/analyse', handleVoiceAnalysis);
app.post('/api/pataka/analyse', handlePatakaAnalysis);
app.post('/api/reading/analyse', handleReadingAnalysis);

app.listen(PORT, () => {
  console.log(`ParkinsonsShortcut backend running on http://localhost:${PORT}`);
  console.log(`MOCK_AI = ${process.env.MOCK_AI}`);
});
