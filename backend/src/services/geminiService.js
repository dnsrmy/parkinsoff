import { GoogleGenerativeAI } from '@google/generative-ai';

const MOCK_RESPONSES = {
  watch: {
    explanation:
      'Multiple signals detected across motor, voice, and prodromal categories. This pattern warrants medical attention. The combination of motor and non-motor indicators is clinically significant. Please consult a neurologist — early intervention is where outcomes improve most.',
    preventiveShortcut:
      'Schedule a neurology consultation within the next four weeks. Log your symptoms daily using this app. Early diagnosis enables access to neuroprotective strategies before significant progression.',
    exerciseRecommendation:
      'Rock Steady Boxing (PD-specific) or Dance/Movement Therapy three times per week. High-intensity aerobic exercise has strong evidence for slowing motor decline in early Parkinson\'s.',
    severityLevel: 'watch',
    disclaimer:
      'This is not a medical diagnosis. These results reflect patterns from a self-administered screening tool and must be evaluated by a qualified neurologist.',
  },
  medium: {
    explanation:
      'A moderate number of Parkinson\'s-associated signals were identified. Some indicators align with known early-stage markers. While this is not a diagnosis, the pattern is worth discussing with your doctor at your next visit.',
    preventiveShortcut:
      'Increase aerobic exercise frequency and discuss your results with your GP. Consider tracking any changes in handwriting, movement speed, or sleep quality over the coming weeks.',
    exerciseRecommendation:
      'Brisk walking or cycling 30 minutes daily, five days per week. Adding balance and coordination exercises (tai chi, yoga) twice a week has shown neuroprotective benefits.',
    severityLevel: 'medium',
    disclaimer:
      'This is not a medical diagnosis. Please consult a neurologist if you are concerned about these results.',
  },
  low: {
    explanation:
      'A small number of signals were noted, which may reflect normal variation or early lifestyle factors. No strong pattern of Parkinson\'s indicators was found. Continue monitoring over time.',
    preventiveShortcut:
      'Maintain an active lifestyle and retake this assessment in 3–6 months. Log any new symptoms, particularly changes in smell, sleep quality, or fine motor control.',
    exerciseRecommendation:
      'Any regular aerobic exercise is beneficial for long-term brain health. Aim for 150 minutes per week of moderate activity: walking, swimming, or cycling.',
    severityLevel: 'low',
    disclaimer:
      'This is not a medical diagnosis. Please consult a neurologist if you are concerned about these results.',
  },
  none: {
    explanation:
      'No significant Parkinson\'s-associated signals were detected in this assessment. Your motor speed, voice, drawing control, and prodromal indicators all appear within normal ranges.',
    preventiveShortcut:
      'Keep up your active lifestyle. Retake this assessment in 6–12 months as a preventive baseline.',
    exerciseRecommendation:
      'Continue regular exercise for neuroprotection. Aerobic activity, strength training, and coordination exercises all support long-term brain health.',
    severityLevel: 'none',
    disclaimer:
      'This is not a medical diagnosis. A normal screening result does not exclude Parkinson\'s disease.',
  },
};

const MOCK_VOICE = {
  phonationTime: 8.2,
  amplitudeCV: 0.18,
  voiceTremor: false,
  observations: 'Sustained phonation within normal range, stable amplitude throughout.',
};

const MOCK_FACE = {
  difficulty: 'easy',
  facialMobility: 'normal',
  observations: 'Full range of facial expressions observed. No signs of hypomimia.',
};

export async function callGemini(payload) {
  if (process.env.MOCK_AI === 'true') {
    const severity = payload.severity || 'none';
    const base = MOCK_RESPONSES[severity] || MOCK_RESPONSES.none;
    return { ...base, detectedSignals: payload.detectedSignals || [] };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a clinical AI assistant for Parkinson's disease screening.

Test data summary: ${payload.symptoms}
Detected signals: ${(payload.detectedSignals || []).join(', ') || 'none'}
Severity level: ${payload.severity || 'none'}

Provide a screening analysis. Return ONLY a JSON object with these exact fields:
- explanation: clinical interpretation (2-3 sentences, professional tone)
- preventiveShortcut: most important action to take right now (1-2 sentences)
- exerciseRecommendation: specific exercise recommendation with evidence basis (1-2 sentences)
- severityLevel: one of "watch", "medium", "low", "none"
- disclaimer: short medical disclaimer (1 sentence)

Do not include detectedSignals in your response.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini returned non-JSON response');
  const parsed = JSON.parse(jsonMatch[0]);
  return { ...parsed, detectedSignals: payload.detectedSignals || [] };
}

export async function analyzeVoiceWithGemini(base64Audio, mimeType) {
  if (process.env.MOCK_AI === 'true') {
    await new Promise(r => setTimeout(r, 600));
    return MOCK_VOICE;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    { inlineData: { data: base64Audio, mimeType } },
    `Analyze this voice recording for Parkinson's disease screening. The person is sustaining a vowel sound "ahhhh".

Return ONLY a JSON object:
- phonationTime: seconds of sustained phonation (number, 0-15)
- amplitudeCV: coefficient of variation in amplitude (number, 0-1; lower = more stable)
- voiceTremor: detected tremor in voice (boolean)
- observations: brief clinical observation (string, max 120 chars)

Thresholds: phonationTime < 7s is clinically significant, amplitudeCV > 0.35 indicates instability.`,
  ]);

  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini voice analysis failed');
  return JSON.parse(jsonMatch[0]);
}

export async function analyzeFaceWithGemini(base64Video, mimeType) {
  if (process.env.MOCK_AI === 'true') {
    await new Promise(r => setTimeout(r, 600));
    return MOCK_FACE;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    { inlineData: { data: base64Video, mimeType } },
    `Analyze this video for Parkinson's disease facial screening (hypomimia detection). The person is performing facial expression tasks: smiling, raising eyebrows, and looking in different directions.

Return ONLY a JSON object:
- difficulty: perceived difficulty level — "easy", "some", or "difficult"
- facialMobility: "normal", "reduced", or "significantly_reduced"
- observations: brief clinical observation (string, max 120 chars)

Look for: range of facial movement, speed of expression change, facial rigidity or masking.`,
  ]);

  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini face analysis failed');
  return JSON.parse(jsonMatch[0]);
}
