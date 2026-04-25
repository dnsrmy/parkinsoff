import 'dotenv/config';

function getMockReadingResult() {
  return {
    valid: true,
    isMock: true,
    speech_rate_wpm: parseFloat((140 + Math.random() * 50).toFixed(1)),
    pause_ratio: parseFloat((0.08 + Math.random() * 0.12).toFixed(3)),
    mockWarning: 'MOCK_AI=true — set MOCK_AI=false to use real Speech-to-Text analysis.',
    limitation: 'Mock data only. Set MOCK_AI=false in backend/.env for real analysis.',
  };
}

export async function handleReadingAnalysis(req, res) {
  const recordingId = `reading_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (process.env.MOCK_AI === 'true') {
    console.log(`[Reading:${recordingId}] MOCK_AI=true — returning mock response`);
    return res.status(200).json({ ...getMockReadingResult(), recordingId });
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
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await client.recognize(request);
    const allWords = response.results.flatMap(r => r.alternatives[0]?.words || []);

    if (allWords.length === 0) {
      return res.status(200).json({
        ...getMockReadingResult(),
        recordingId,
        isMock: true,
        mockWarning: 'No speech detected. Using mock data.',
      });
    }

    const startSec = parseFloat(allWords[0].startTime?.seconds || 0);
    const endSec = parseFloat(allWords[allWords.length - 1].endTime?.seconds || 1);
    const totalDuration = Math.max(endSec - startSec, 0.1);

    const wordCount = allWords.length;
    const speech_rate_wpm = parseFloat(((wordCount / totalDuration) * 60).toFixed(1));

    let totalPauseTime = 0;
    for (let i = 1; i < allWords.length; i++) {
      const gapStart = parseFloat(allWords[i - 1].endTime?.seconds || 0);
      const gapEnd = parseFloat(allWords[i].startTime?.seconds || 0);
      const gap = gapEnd - gapStart;
      if (gap > 0.3) totalPauseTime += gap;
    }
    const pause_ratio = parseFloat((totalPauseTime / totalDuration).toFixed(3));

    return res.status(200).json({
      valid: true,
      isMock: false,
      recordingId,
      speech_rate_wpm,
      pause_ratio,
      wordCount,
      totalDuration: parseFloat(totalDuration.toFixed(1)),
      limitation: 'Speech rate computed from recognized word count. Accuracy depends on audio quality.',
    });
  } catch (err) {
    console.error(`[Reading:${recordingId}] Error:`, err.message);
    return res.status(200).json({
      ...getMockReadingResult(),
      recordingId,
      isMock: true,
      mockWarning: `Real analysis failed (${err.message}). Using mock data.`,
    });
  }
}
