// Multi-modal score fusion for the legacy (old) flow.
// Combines voice and spiral results with self-reported symptom weights.

export function fuseScores(voiceResult, spiralResult, selfReportSignals = []) {
  const modalities = [];
  let weightedSum = 0;
  let totalWeight = 0;

  if (voiceResult?.voiceScore != null) {
    const w = 0.45;
    weightedSum += voiceResult.voiceScore * w;
    totalWeight += w;
    modalities.push('voice');
  }

  if (spiralResult) {
    const irregularity = spiralResult.metrics?.irregularity ?? 0;
    const score = Math.min(1, irregularity / 0.5);
    const w = 0.35;
    weightedSum += score * w;
    totalWeight += w;
    modalities.push('spiral');
  }

  const selfScore = selfReportSignals.reduce((acc, s) => acc + (s.weight || 0), 0);
  if (selfScore > 0) {
    const normalised = Math.min(1, selfScore / 5);
    const w = 0.20;
    weightedSum += normalised * w;
    totalWeight += w;
    modalities.push('self-report');
  }

  if (totalWeight === 0) return null;

  const combinedScore = weightedSum / totalWeight;

  const concordance = modalities.length >= 2 ? 'multi-modal' : 'single-modal';
  const confidence = modalities.length >= 2 ? 'moderate' : 'low';

  const summary = combinedScore <= 0.33
    ? 'Combined signals are within typical ranges across the modalities tested.'
    : combinedScore <= 0.66
    ? 'Some combined signals are worth monitoring. Consider repeating the assessment in 4–6 weeks.'
    : 'Multiple modalities show patterns worth discussing with a healthcare professional.';

  return { combinedScore, modalities, concordance, confidence, summary };
}

export function analyseSpiral(points, canvasWidth, canvasHeight) {
  if (!points || points.length < 20) return { valid: false, signalLevel: 'unknown', metrics: {}, signalPatterns: [] };

  const velocities = [];
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].t - points[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
  }

  let velocityCV = 0;
  if (velocities.length > 1) {
    const meanV = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const varV  = velocities.reduce((s, v) => s + (v - meanV) ** 2, 0) / velocities.length;
    velocityCV = meanV > 0 ? Math.sqrt(varV) / meanV : 0;
  }

  const signalLevel = velocityCV < 0.35 ? 'within_range'
    : velocityCV < 0.60 ? 'worth_monitoring'
    : 'outside_range';

  const signalPatterns = [{
    metric: 'Velocity variability (CV)',
    value: velocityCV.toFixed(3),
    status: signalLevel,
    reference: 'CV < 0.35 is within typical range (Pullman 1998)',
  }];

  return { valid: true, signalLevel, metrics: { velocityCV }, signalPatterns };
}

export function formatScoreForDisplay(score) {
  if (score == null) return 'N/A';
  return `${Math.round(score * 100)}`;
}
