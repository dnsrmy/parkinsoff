import 'dotenv/config';

function getMockPatakaResult() {
  const syllable_rate = parseFloat((4.5 + Math.random() * 2.0).toFixed(2));
  const rhythm_cv = parseFloat((0.10 + Math.random() * 0.20).toFixed(3));
  return {
    valid: true,
    isMock: true,
    syllable_rate,
    rhythm_cv,
    mockWarning: 'MOCK_AI=true — set MOCK_AI=false to use real Speech-to-Text analysis.',
    limitation: 'Mock data only. Set MOCK_AI=false in backend/.env for real analysis.',
  };
}

export async function handlePatakaAnalysis(req, res) {
  const recordingId = `pataka_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (process.env.MOCK_AI === 'true') {
    console.log(`[Pataka:${recordingId}] MOCK_AI=true — returning mock response`);
    return res.status(200).json({ ...getMockPatakaResult(), recordingId });
  }

  try {
    const { audio, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'No audio provided', recordingId });

    const { SpeechClient } = await import('@google-cloud/speech');
    const client = new SpeechClient();

    const request = {
      audio: { content: audio },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableWordTimeOffsets: true,
      },
    };

    const [response] = await client.recognize(request);
    const transcript = response.results
      .map(r => r.alternatives[0]?.transcript || '')
      .join(' ')
      .toLowerCase();

    // Estimate syllable count from recognized syllable-like units
    const words = transcript.split(/\s+/).filter(Boolean);
    // pa, ta, ka each count as 1 syllable; pataka = 3
    const syllableCount = words.reduce((sum, w) => {
      const matches = w.match(/[aeiou]/gi) || [];
      return sum + Math.max(1, matches.length);
    }, 0);
    const syllable_rate = parseFloat((syllableCount / 10).toFixed(2));

    // Rhythm CV from word timestamps
    const allWords = response.results.flatMap(r => r.alternatives[0]?.words || []);
    let rhythm_cv = 0.15;
    if (allWords.length >= 3) {
      const intervals = [];
      for (let i = 1; i < allWords.length; i++) {
        const prev = parseFloat(allWords[i - 1].endTime?.seconds || 0);
        const curr = parseFloat(allWords[i].startTime?.seconds || 0);
        intervals.push(curr - prev);
      }
      if (intervals.length > 0) {
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
        rhythm_cv = mean > 0 ? parseFloat((Math.sqrt(variance) / mean).toFixed(3)) : 0.15;
      }
    }

    return res.status(200).json({
      valid: true,
      isMock: false,
      recordingId,
      syllable_rate,
      rhythm_cv,
      transcript,
      limitation: 'Pa-ta-ka rate is estimated from speech recognition. Timing precision depends on audio quality.',
    });
  } catch (err) {
    console.error(`[Pataka:${recordingId}] Error:`, err.message);
    return res.status(200).json({
      ...getMockPatakaResult(),
      recordingId,
      isMock: true,
      mockWarning: `Real analysis failed (${err.message}). Using mock data.`,
    });
  }
}
