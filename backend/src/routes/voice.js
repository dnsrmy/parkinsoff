// Voice analysis route: POST /api/voice/analyse
// Uses Google Speech-to-Text for duration cross-check + Gemini for pattern analysis.
// PCM stats from browser Web Audio API are the primary feature source (not compressed bytes).
// Dataset reference: UCI Oxford Parkinson's voice data (Little et al. 2008, n=195).
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy-initialise SpeechClient so module loads fine when credentials are absent (MOCK_AI=true).
let _speechClient = null;
async function getSpeechClient() {
  if (!_speechClient) {
    const { SpeechClient } = await import('@google-cloud/speech');
    _speechClient = new SpeechClient();
  }
  return _speechClient;
}

const encodingMap = {
  'audio/webm': 'WEBM_OPUS',
  'audio/webm;codecs=opus': 'WEBM_OPUS',
  'audio/ogg': 'OGG_OPUS',
  'audio/ogg;codecs=opus': 'OGG_OPUS',
  'audio/mp4': 'MP3',
};

/**
 * Extract byte-level audio proxies from raw compressed audio bytes.
 * Used as fallback when pcmStats are not provided by the browser.
 * NOTE: WEBM_OPUS bytes are compressed frames, not PCM. These values
 * are directional proxies only — pcmStats from Web Audio API are preferred.
 */
function extractAcousticFeatures(audioBytes) {
  const features = {
    byteSize: audioBytes.length,
    estimatedDurationSec: null,
    rmsEnergy: null,
    energyVariance: null,
    silenceRatio: null,
    peakAmplitude: null,
    zeroCrossingRate: null,
    clippingRatio: null,
    energyEntropy: null,
    qualityFlag: 'unknown',
    pcmSource: false,
  };

  features.estimatedDurationSec = Math.min(120, Math.max(0, audioBytes.length / 6000));

  const sampleSize = Math.min(audioBytes.length, 20000);
  const step = Math.max(1, Math.floor(audioBytes.length / sampleSize));
  const samples = [];
  for (let i = 0; i < audioBytes.length; i += step) {
    samples.push((audioBytes[i] - 128) / 128);
  }

  if (samples.length < 10) {
    features.qualityFlag = 'too_short';
    return features;
  }

  const sumSquares = samples.reduce((s, v) => s + v * v, 0);
  features.rmsEnergy = Math.sqrt(sumSquares / samples.length);
  features.peakAmplitude = Math.max(...samples.map(Math.abs));

  const windowCount = 10;
  const windowSize = Math.floor(samples.length / windowCount);
  const windowRMS = [];
  for (let w = 0; w < windowCount; w++) {
    const win = samples.slice(w * windowSize, (w + 1) * windowSize);
    const wRMS = Math.sqrt(win.reduce((s, v) => s + v * v, 0) / win.length);
    windowRMS.push(wRMS);
  }
  const meanWindowRMS = windowRMS.reduce((a, b) => a + b, 0) / windowRMS.length;
  features.energyVariance = windowRMS.reduce((s, v) => s + (v - meanWindowRMS) ** 2, 0) / windowRMS.length;

  features.silenceRatio = samples.filter(v => Math.abs(v) < 0.02).length / samples.length;

  let zeroCrossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) zeroCrossings++;
  }
  features.zeroCrossingRate = zeroCrossings / samples.length;
  features.clippingRatio = samples.filter(v => Math.abs(v) > 0.95).length / samples.length;

  const maxWRMS = Math.max(...windowRMS, 0.0001);
  const normWRMS = windowRMS.map(v => v / maxWRMS + 0.0001);
  features.energyEntropy = -normWRMS.reduce((s, p) => s + p * Math.log(p), 0) / Math.log(windowCount);

  // amplitudeCV fallback: approximate from byte-level samples
  const activeSamples = samples.filter(v => Math.abs(v) > 0.02);
  if (activeSamples.length > 0) {
    const mean = activeSamples.reduce((a, b) => a + b, 0) / activeSamples.length;
    const variance = activeSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / activeSamples.length;
    features.amplitudeCV = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 0;
  } else {
    features.amplitudeCV = 0;
  }

  if (features.rmsEnergy < 0.01) features.qualityFlag = 'too_quiet';
  else if (features.silenceRatio > 0.7) features.qualityFlag = 'mostly_silence';
  else if (features.clippingRatio > 0.05) features.qualityFlag = 'clipping';
  else if (features.rmsEnergy > 0.05 && features.silenceRatio < 0.4) features.qualityFlag = 'good';
  else features.qualityFlag = 'fair';

  return features;
}

/**
 * Merge browser-computed PCM stats with byte-level features.
 * pcmStats override the key acoustic features — they come from real PCM via Web Audio API.
 */
function mergePcmStats(byteFeatures, pcmStats) {
  return {
    ...byteFeatures,
    estimatedDurationSec: pcmStats.phonationTime,
    energyVariance: pcmStats.energyVariance,
    silenceRatio: pcmStats.silenceRatio,
    amplitudeCV: pcmStats.amplitudeCV,
    phonationTime: pcmStats.phonationTime,
    totalDuration: pcmStats.totalDuration,
    pcmSource: true,
  };
}

async function analyseVoiceWithGemini(features, sttDuration) {
  if (!features || features.qualityFlag === 'too_short') {
    return { geminiAnalysis: null, warning: 'Recording too short for analysis.' };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });

    const cv = features.amplitudeCV != null ? features.amplitudeCV.toFixed(3) : 'n/a';
    const source = features.pcmSource ? 'Web Audio API PCM (reliable)' : 'byte-level proxy (fallback)';

    const prompt = `You are analysing a sustained vowel voice recording for a Parkinson's screening awareness tool.
This is NOT a diagnosis. You are interpreting measured acoustic signals only.

MEASURED VALUES FROM THIS SPECIFIC RECORDING (source: ${source}):
- Phonation duration: ${features.estimatedDurationSec.toFixed(2)} seconds
- Amplitude CV (stability): ${cv} (0=perfectly stable; >0.35 suggests instability)
- Energy variance across windows: ${features.energyVariance.toFixed(6)} (lower = more stable)
- Silence ratio: ${(features.silenceRatio * 100).toFixed(1)}% of recording is near-silent
- RMS energy: ${features.rmsEnergy?.toFixed(4) ?? 'n/a'} (byte-level proxy)
- Energy entropy: ${features.energyEntropy?.toFixed(4) ?? 'n/a'} (0=stable, 1=irregular)
- Recording quality flag: ${features.qualityFlag}
- STT-estimated duration: ${sttDuration ? sttDuration.toFixed(2) + 's' : 'not available'}

REFERENCE CONTEXT (for awareness, not diagnosis):
- Sustained phonation of 8+ seconds is within typical healthy adult range (Baken & Orlikoff 2000)
- Amplitude CV above 0.35 is a voice tremor/instability marker (Bhatt et al.)
- Higher energy variance suggests less stable phonation
- Silence ratio above 50% in a sustained vowel task is unusual

IMPORTANT RULES:
- You MUST reference the actual measured numbers above in your response
- Do NOT use generic sentences — your response must change based on these specific values
- Do NOT claim diagnosis — use "screening pattern" language only

Respond with ONLY a JSON object — no preamble, no markdown:
{
  "phonationDurationSignal": "within_range" | "worth_monitoring" | "outside_range",
  "phonationDurationNote": "specific sentence referencing the ${features.estimatedDurationSec.toFixed(1)}s duration",
  "voiceStabilitySignal": "within_range" | "worth_monitoring" | "outside_range",
  "voiceStabilityNote": "specific sentence referencing amplitude CV ${cv} and energy variance ${features.energyVariance.toFixed(6)}",
  "recordingQualityNote": "specific sentence about quality flag '${features.qualityFlag}'",
  "overallVoicePattern": "low_concern" | "moderate_concern" | "notable_concern",
  "patternNote": "2-sentence summary referencing at least two specific measured values from above",
  "disclaimer": "This is a screening awareness signal only, not a clinical assessment."
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const rawText = result.response.candidates[0].content.parts[0].text;
    const cleaned = rawText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    return { geminiAnalysis: JSON.parse(cleaned), warning: null };
  } catch (err) {
    console.error('[Voice] Gemini analysis error:', err.message);
    return { geminiAnalysis: null, warning: 'Gemini analysis unavailable: ' + err.message };
  }
}

function buildSignalPatterns(features, geminiAnalysis) {
  const patterns = [];

  // Duration
  const dur = features.estimatedDurationSec;
  patterns.push({
    metric: 'Phonation duration',
    value: dur.toFixed(1) + 's',
    reference: 'Above 8 seconds is within the expected lower-risk range (UCI Oxford Parkinson\'s dataset)',
    status: dur >= 8 ? 'within_range' : dur >= 5 ? 'worth_monitoring' : 'outside_range',
    measuredValue: dur,
  });

  // Amplitude CV (PCM-derived when available, byte-level otherwise)
  const cv = features.amplitudeCV;
  if (cv != null) {
    patterns.push({
      metric: features.pcmSource ? 'Voice amplitude stability (CV)' : 'Voice amplitude stability (CV, byte proxy)',
      value: cv.toFixed(3),
      reference: 'Amplitude CV below 0.35 is within lower-risk range; above 0.35 suggests voice instability (Bhatt et al.)',
      status: cv < 0.25 ? 'within_range' : cv < 0.40 ? 'worth_monitoring' : 'outside_range',
      measuredValue: cv,
    });
  }

  // Energy variance
  const ev = features.energyVariance;
  patterns.push({
    metric: 'Phonation stability (energy variance)',
    value: ev.toFixed(6),
    reference: 'Lower variance indicates more stable sustained phonation',
    status: ev < 0.002 ? 'within_range' : ev < 0.008 ? 'worth_monitoring' : 'outside_range',
    measuredValue: ev,
  });

  // Silence ratio
  const sr = features.silenceRatio;
  patterns.push({
    metric: 'Silence ratio',
    value: (sr * 100).toFixed(1) + '%',
    reference: 'Below 40% silence in a sustained vowel task is within expected range',
    status: sr < 0.40 ? 'within_range' : sr < 0.65 ? 'worth_monitoring' : 'outside_range',
    measuredValue: sr,
  });

  // Energy entropy (byte-level only — not in pcmStats)
  if (features.energyEntropy != null) {
    const ee = features.energyEntropy;
    patterns.push({
      metric: 'Phonation regularity (energy entropy)',
      value: ee.toFixed(4),
      reference: 'Lower entropy = more stable; near 1.0 = irregular phonation pattern',
      status: ee < 0.5 ? 'within_range' : ee < 0.75 ? 'worth_monitoring' : 'outside_range',
      measuredValue: ee,
    });
  }

  // Gemini qualitative patterns (if available)
  if (geminiAnalysis) {
    if (geminiAnalysis.voiceStabilitySignal) {
      patterns.push({
        metric: 'Voice stability assessment (Gemini)',
        value: geminiAnalysis.voiceStabilitySignal.replace(/_/g, ' '),
        reference: geminiAnalysis.voiceStabilityNote || '',
        status: geminiAnalysis.voiceStabilitySignal,
        isGemini: true,
      });
    }
    if (geminiAnalysis.overallVoicePattern) {
      const overallStatus = { low_concern: 'within_range', moderate_concern: 'worth_monitoring', notable_concern: 'outside_range' }[geminiAnalysis.overallVoicePattern] || 'worth_monitoring';
      patterns.push({
        metric: 'Overall voice screening signal (Gemini)',
        value: geminiAnalysis.overallVoicePattern.replace(/_/g, ' '),
        reference: geminiAnalysis.patternNote || '',
        status: overallStatus,
        isGemini: true,
      });
    }
  }

  return patterns;
}

/**
 * Compute voiceScore with smooth normalized weighted ponderation.
 * All 5 features contribute — no binary thresholds.
 * Returns { voiceScore, normalized, contributions } for full transparency.
 */
function computeVoiceScore(features, geminiAnalysis) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const dur = features.estimatedDurationSec ?? 0;
  const cv  = features.amplitudeCV ?? 0;
  const ev  = features.energyVariance ?? 0;
  const sr  = features.silenceRatio ?? 0;

  // Smooth normalized concern scores [0,1] — higher = more concern
  const f_dur = clamp(1 - dur / 10, 0, 1);   // 10s → 0; 0s → 1
  const f_cv  = clamp(cv / 0.6, 0, 1);         // CV 0 → 0; 0.6+ → 1
  const f_ev  = clamp(ev / 0.015, 0, 1);       // variance 0 → 0; 0.015+ → 1
  const f_sr  = clamp(sr / 0.80, 0, 1);        // silence 0 → 0; 0.80+ → 1
  const f_gem = { low_concern: 0, moderate_concern: 0.5, notable_concern: 1.0 }[geminiAnalysis?.overallVoicePattern] ?? 0;

  const contributions = {
    duration:       0.30 * f_dur,
    amplitudeCV:    0.35 * f_cv,
    energyVariance: 0.20 * f_ev,
    silenceRatio:   0.10 * f_sr,
    gemini:         0.05 * f_gem,
  };

  const voiceScore = Math.min(1, Object.values(contributions).reduce((a, b) => a + b, 0));

  console.log(`[Voice] Score breakdown — dur=${f_dur.toFixed(2)}×0.30, cv=${f_cv.toFixed(2)}×0.35, ev=${f_ev.toFixed(2)}×0.20, sr=${f_sr.toFixed(2)}×0.10, gem=${f_gem.toFixed(2)}×0.05 → voiceScore=${voiceScore.toFixed(3)}`);

  return {
    voiceScore,
    normalized: { f_dur, f_cv, f_ev, f_sr, f_gemini: f_gem },
    contributions,
  };
}

function buildInterpretation(features, geminiAnalysis, voiceScore) {
  const dur = features.estimatedDurationSec.toFixed(1);
  const cv  = features.amplitudeCV != null ? features.amplitudeCV.toFixed(3) : null;
  const ev  = features.energyVariance.toFixed(6);
  const sr  = (features.silenceRatio * 100).toFixed(1);

  const level = voiceScore < 0.20 ? 'low' : voiceScore < 0.45 ? 'moderate' : 'notable';

  const durNote = parseFloat(dur) >= 8
    ? `Phonation duration of ${dur}s is within the expected lower-risk range.`
    : `Phonation duration of ${dur}s is below the 8-second lower-risk reference.`;

  const stabilityNote = features.energyVariance < 0.002
    ? `Energy variance of ${ev} indicates stable phonation.`
    : features.energyVariance < 0.008
    ? `Energy variance of ${ev} suggests some phonation irregularity.`
    : `Energy variance of ${ev} indicates notable phonation instability.`;

  const cvNote = cv != null
    ? ` Amplitude CV: ${cv}${parseFloat(cv) > 0.35 ? ' — above stability reference.' : '.'}`
    : '';

  let qualityNote = '';
  if (features.qualityFlag === 'clipping') qualityNote = ' Note: recording shows clipping — please reduce microphone volume.';
  else if (features.qualityFlag === 'too_quiet') qualityNote = ' Note: recording is very quiet — please speak louder.';
  else if (features.silenceRatio > 0.5) qualityNote = ` Note: ${sr}% of the recording is near-silent — ensure you sustained the vowel continuously.`;

  const geminiNote = geminiAnalysis?.patternNote ? ` ${geminiAnalysis.patternNote}` : '';
  const sourceNote = features.pcmSource ? '' : ' [Byte-level analysis — PCM stats unavailable]';

  return `${durNote} ${stabilityNote}${cvNote}${qualityNote}${geminiNote} Overall screening signal: ${level} concern. Silence ratio: ${sr}%.${sourceNote}`;
}

function getMockVoiceResult() {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dur = parseFloat((5 + Math.random() * 8).toFixed(1));
  const cv  = parseFloat((0.1 + Math.random() * 0.5).toFixed(3));
  const ev  = parseFloat((0.001 + Math.random() * 0.012).toFixed(6));
  const sr  = parseFloat((Math.random() * 0.6).toFixed(3));
  const ee  = parseFloat((0.3 + Math.random() * 0.5).toFixed(4));
  const rms = parseFloat((0.02 + Math.random() * 0.12).toFixed(4));

  // Compute mock score using same smooth formula
  const f_dur = clamp(1 - dur / 10, 0, 1);
  const f_cv  = clamp(cv / 0.6, 0, 1);
  const f_ev  = clamp(ev / 0.015, 0, 1);
  const f_sr  = clamp(sr / 0.80, 0, 1);
  const contributions = {
    duration: 0.30 * f_dur,
    amplitudeCV: 0.35 * f_cv,
    energyVariance: 0.20 * f_ev,
    silenceRatio: 0.10 * f_sr,
    gemini: 0,
  };
  const voiceScore = parseFloat(Math.min(1, Object.values(contributions).reduce((a, b) => a + b, 0)).toFixed(3));

  return {
    valid: true,
    isMock: true,
    mockWarning: 'MOCK_AI=true in backend/.env — set MOCK_AI=false to use real Gemini + Speech-to-Text analysis.',
    duration: dur,
    rmsAmplitude: rms,
    quality: rms > 0.05 ? 'good' : 'fair',
    acousticFeatures: {
      byteSize: Math.round(dur * 6000),
      estimatedDurationSec: dur,
      rmsEnergy: rms,
      energyVariance: ev,
      silenceRatio: sr,
      energyEntropy: ee,
      amplitudeCV: cv,
      qualityFlag: rms > 0.05 ? 'good' : 'fair',
      pcmSource: false,
    },
    geminiAnalysis: {
      phonationDurationSignal: dur >= 8 ? 'within_range' : 'worth_monitoring',
      phonationDurationNote: `Duration of ${dur}s — mock value, set MOCK_AI=false for real analysis.`,
      voiceStabilitySignal: cv < 0.35 ? 'within_range' : 'worth_monitoring',
      voiceStabilityNote: `Mock stability: amplitude CV ${cv}, energy variance ${ev}.`,
      recordingQualityNote: `Mock quality: ${rms > 0.05 ? 'good' : 'fair'} (RMS ${rms}).`,
      overallVoicePattern: 'low_concern',
      patternNote: `Mock result: duration ${dur}s, amplitude CV ${cv}. Enable real analysis by setting MOCK_AI=false in backend/.env.`,
      disclaimer: 'This is mock data for development only.',
    },
    signalPatterns: [
      { metric: 'Phonation duration', value: dur + 's', reference: 'Mock — set MOCK_AI=false for real values', status: dur >= 8 ? 'within_range' : 'worth_monitoring', measuredValue: dur },
      { metric: 'Voice amplitude stability (CV)', value: cv.toString(), reference: 'Mock — set MOCK_AI=false for real values', status: cv < 0.25 ? 'within_range' : cv < 0.40 ? 'worth_monitoring' : 'outside_range', measuredValue: cv },
      { metric: 'Phonation stability (energy variance)', value: ev.toString(), reference: 'Mock — set MOCK_AI=false for real values', status: ev < 0.002 ? 'within_range' : 'worth_monitoring', measuredValue: ev },
      { metric: 'Silence ratio', value: (sr * 100).toFixed(1) + '%', reference: 'Mock — set MOCK_AI=false for real values', status: sr < 0.4 ? 'within_range' : 'worth_monitoring', measuredValue: sr },
      { metric: 'Phonation regularity (energy entropy)', value: ee.toString(), reference: 'Mock — set MOCK_AI=false for real values', status: ee < 0.5 ? 'within_range' : 'worth_monitoring', measuredValue: ee },
    ],
    voiceScore,
    normalized: { f_dur, f_cv, f_ev, f_sr, f_gemini: 0 },
    contributions,
    interpretation: `[MOCK] Duration ${dur}s, amplitude CV ${cv}, silence ${(sr * 100).toFixed(0)}%. Set MOCK_AI=false in backend/.env for real acoustic analysis.`,
    limitation: 'Mock data only. Set MOCK_AI=false in backend/.env for real analysis.',
    disclaimer: 'Mock data — not a medical assessment.',
  };
}

export async function handleVoiceAnalysis(req, res) {
  const recordingId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[Voice:${recordingId}] New recording request received`);

  const { audio, mimeType, pcmStats } = req.body;
  if (!audio) return res.status(400).json({ valid: false, reason: 'no_audio', message: 'No audio data provided.' });

  if (process.env.MOCK_AI === 'true') {
    console.log(`[Voice:${recordingId}] MOCK_AI=true — returning mock response. Set MOCK_AI=false for real analysis.`);
    return res.status(200).json({ ...getMockVoiceResult(), recordingId });
  }

  try {
    const audioBytes = Buffer.from(audio, 'base64');
    console.log(`[Voice:${recordingId}] Audio bytes received: ${audioBytes.length}`);

    // Step 1: Extract byte-level features (used as fallback or for entropy/ZCR supplemental data)
    const byteFeatures = extractAcousticFeatures(audioBytes);

    // Step 2: Merge pcmStats as primary source (real PCM from Web Audio API)
    const features = pcmStats ? mergePcmStats(byteFeatures, pcmStats) : byteFeatures;
    console.log(`[Voice:${recordingId}] Feature source: ${features.pcmSource ? 'PCM (browser Web Audio API)' : 'byte-level (fallback — pcmStats not provided)'}`);
    console.log(`[Voice:${recordingId}] Features: dur=${features.estimatedDurationSec?.toFixed(2)}s, cv=${features.amplitudeCV?.toFixed(3)}, ev=${features.energyVariance?.toFixed(6)}, sr=${features.silenceRatio?.toFixed(3)}, quality=${features.qualityFlag}`);

    // Step 3: Validate minimum quality
    if (features.qualityFlag === 'too_short' || (features.rmsEnergy != null && features.rmsEnergy < 0.005 && !features.pcmSource)) {
      return res.status(200).json({
        valid: false,
        recordingId,
        isMock: false,
        reason: 'feature_extraction_failed',
        message: 'We could not extract reliable voice features from this recording. Please ensure you are speaking clearly and try again.',
        acousticFeatures: features,
      });
    }

    if (features.qualityFlag === 'mostly_silence') {
      return res.status(200).json({
        valid: false,
        recordingId,
        isMock: false,
        reason: 'mostly_silence',
        message: 'The recording appears mostly silent. Please speak clearly during the recording and try again.',
        acousticFeatures: features,
      });
    }

    // Step 4: STT for duration cross-check (optional — graceful degradation if fails)
    let sttDuration = null;
    try {
      const speechClient = await getSpeechClient();
      const [sttResponse] = await speechClient.recognize({
        audio: { content: audio },
        config: {
          encoding: encodingMap[mimeType] || 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'es-ES',
          alternativeLanguageCodes: ['en-US', 'en-GB'],
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: false,
          model: 'default',
        },
      });
      const allWords = (sttResponse.results || []).flatMap(r => r.alternatives[0]?.words || []);
      if (allWords.length > 0) {
        const lastWord = allWords[allWords.length - 1];
        const endSec = parseInt(lastWord.endTime?.seconds || 0) + (parseInt(lastWord.endTime?.nanos || 0) / 1e9);
        sttDuration = endSec > 0 ? endSec : null;
      }
      console.log(`[Voice:${recordingId}] STT duration: ${sttDuration}`);
    } catch (sttErr) {
      console.warn(`[Voice:${recordingId}] STT failed (non-fatal): ${sttErr.message}`);
    }

    // Step 5: Gemini analysis with all measured features
    const { geminiAnalysis, warning } = await analyseVoiceWithGemini(features, sttDuration);
    console.log(`[Voice:${recordingId}] Gemini result:`, JSON.stringify(geminiAnalysis));

    // Step 6: Build signal patterns and compute weighted pondererd score
    const signalPatterns = buildSignalPatterns(features, geminiAnalysis);
    const { voiceScore, normalized, contributions } = computeVoiceScore(features, geminiAnalysis);
    console.log(`[Voice:${recordingId}] voiceScore=${voiceScore.toFixed(3)}, patterns=${signalPatterns.length}`);

    return res.status(200).json({
      valid: true,
      recordingId,
      isMock: false,
      duration: features.estimatedDurationSec,
      rmsAmplitude: features.rmsEnergy,
      quality: features.qualityFlag,
      acousticFeatures: features,
      geminiAnalysis,
      geminiWarning: warning,
      signalPatterns,
      voiceScore,
      normalized,
      contributions,
      interpretation: buildInterpretation(features, geminiAnalysis, voiceScore),
      limitation: features.pcmSource
        ? 'Voice analysis uses Web Audio API PCM-derived features and Gemini qualitative analysis. These are NOT equivalent to clinical MDVP voice measurements.'
        : 'Voice analysis uses raw byte-level audio proxies and Gemini qualitative analysis. These are NOT equivalent to clinical MDVP voice measurements.',
      disclaimer: 'This is not a medical assessment. Results are for personal awareness only.',
    });
  } catch (err) {
    console.error(`[Voice:${recordingId}] Unhandled error:`, err);
    return res.status(500).json({
      valid: false,
      recordingId,
      reason: 'server_error',
      message: 'Voice analysis encountered an error. Please try again.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}
