import { Router } from 'express';
import { callGemini, analyzeVoiceWithGemini, analyzeFaceWithGemini } from '../services/geminiService.js';

const router = Router();

router.post('/', async (req, res) => {
  const { symptoms, detectedSignals, severity } = req.body;
  if (!symptoms || typeof symptoms !== 'string' || !symptoms.trim()) {
    return res.status(400).json({ error: 'symptoms is required and must be a non-empty string' });
  }
  try {
    const result = await callGemini({ symptoms, detectedSignals, severity });
    return res.json(result);
  } catch (err) {
    console.error('callGemini error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/voice', async (req, res) => {
  const { data, mimeType } = req.body;
  if (!data) return res.status(400).json({ error: 'data is required' });
  try {
    const result = await analyzeVoiceWithGemini(data, mimeType || 'audio/webm');
    return res.json(result);
  } catch (err) {
    console.error('voice analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/face', async (req, res) => {
  const { data, mimeType } = req.body;
  if (!data) return res.status(400).json({ error: 'data is required' });
  try {
    const result = await analyzeFaceWithGemini(data, mimeType || 'video/webm');
    return res.json(result);
  } catch (err) {
    console.error('face analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
