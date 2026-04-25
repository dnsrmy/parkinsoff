// Rule-based clinical scoring engine
// Source of truth: Parameters.pdf (thresholds) + Resumen.pdf (5-step scoring rule)
// No score averaging — strong test count + concordance drives the conclusion.
// sustained_vowel result is treated as opaque input — never recomputed here.

import { TEST_CLASSIFICATION } from './thresholds.js';

export function labelMetric(value, metricThreshold) {
  if (value === null || value === undefined || isNaN(value)) return 'unknown';
  const { in_range, borderline, out_of_range } = metricThreshold;

  const matchesBand = (val, band) => {
    if (!band) return false;
    if (Array.isArray(band)) return band.some(b => matchesBand(val, b));
    return (band.min === undefined || val >= band.min) &&
           (band.max === undefined || val <= band.max);
  };

  if (matchesBand(value, out_of_range)) return 'out_of_range';
  if (matchesBand(value, borderline))   return 'borderline';
  if (matchesBand(value, in_range))     return 'in_range';
  return 'in_range';
}

export function labelTest(metricsResults) {
  const labels = Object.values(metricsResults);
  if (labels.includes('out_of_range')) return 'out_of_range';
  if (labels.includes('borderline'))   return 'borderline';
  if (labels.length > 0 && labels.every(l => l === 'in_range' || l === 'unknown')) return 'in_range';
  return 'unknown';
}

export function checkConcordance(testResults, profileAnswers) {
  const tapping = testResults['finger_tapping'];
  const hasAsymmetry =
    tapping?.metrics?.lr_asymmetry === 'out_of_range' ||
    tapping?.metrics?.lr_asymmetry === 'borderline';

  const voiceFlagged = testResults['sustained_vowel']?.status === 'out_of_range';
  const motorFlagged =
    testResults['finger_tapping']?.status === 'out_of_range' ||
    testResults['rest_tremor']?.status === 'out_of_range';
  const hasVoiceMotorMatch = voiceFlagged && motorFlagged;

  const prodromalCount = [
    profileAnswers?.smell_loss,
    profileAnswers?.rem_sleep_disorder,
    profileAnswers?.constipation,
    profileAnswers?.orthostatic_dizziness,
  ].filter(Boolean).length;
  const hasProdromalMatch = prodromalCount >= 2;

  return { hasAsymmetry, hasVoiceMotorMatch, hasProdromalMatch };
}

export function applySessionContext(sessionAnswers) {
  const caveats = [];
  const retestRecommendation = [];

  if (sessionAnswers?.sleep_hours != null && sessionAnswers.sleep_hours < 6) {
    caveats.push(`Low sleep reported (${sessionAnswers.sleep_hours} hours). Fatigue may reduce motor precision.`);
    retestRecommendation.push('Consider retesting after a full night of sleep for more reliable results.');
  }
  if (sessionAnswers?.had_caffeine) {
    caveats.push('Caffeine consumed today. May mildly affect tremor measurements.');
  }
  if (sessionAnswers?.had_alcohol) {
    caveats.push('Alcohol consumed in the last 24 hours. May affect motor control and balance.');
    retestRecommendation.push('Retest when no alcohol has been consumed in the past 24 hours for a cleaner baseline.');
  }
  if (sessionAnswers?.environment === 'Noisy' || sessionAnswers?.environment === true) {
    caveats.push('Noisy environment may reduce voice test accuracy.');
  }

  return { caveats, retestRecommendation };
}

const STRONG_TESTS = ['sustained_vowel', 'rest_tremor', 'finger_tapping'];

const TIER_LABELS = {
  no_indicators:           'No significant indicators detected',
  some_indicators_monitor: 'Some indicators — worth monitoring',
  some_indicators_followup:'Some indicators — follow-up recommended',
  multiple_indicators:     'Multiple indicators — consult a professional',
};

const TIER_EXPLANATIONS = {
  no_indicators:
    'None of the three strong tests flagged any patterns outside the normal range. Continue with regular assessments as a healthy habit.',
  some_indicators_monitor:
    'One of the three strong tests showed patterns worth keeping an eye on. This does not indicate disease. Track changes over the next 4–6 weeks.',
  some_indicators_followup:
    'One strong test flagged a pattern and additional findings are consistent with it. We recommend discussing this with your GP at your next appointment.',
  multiple_indicators:
    'Two or more of the three strong tests flagged patterns outside the normal range. We recommend scheduling an appointment with your GP or a neurologist.',
};

const DISCLAIMER =
  'This result is for personal awareness only and is not a medical diagnosis. ' +
  'Many factors can affect test performance. Always consult a qualified healthcare professional.';

export function computeOverallResult(allTestResults, profileAnswers, sessionAnswers) {
  // Only out_of_range drives tier escalation — borderline never escalates to multiple_indicators
  const outOfRangeStrong = STRONG_TESTS.filter(id =>
    allTestResults?.[id]?.status === 'out_of_range'
  );
  const borderlineStrong = STRONG_TESTS.filter(id =>
    allTestResults?.[id]?.status === 'borderline'
  );

  const concordance = checkConcordance(allTestResults || {}, profileAnswers || {});
  const { caveats, retestRecommendation } = applySessionContext(sessionAnswers || {});

  let resultTier;
  if (outOfRangeStrong.length === 0 && borderlineStrong.length === 0) {
    resultTier = 'no_indicators';
  } else if (outOfRangeStrong.length === 0) {
    resultTier = 'some_indicators_monitor';
  } else if (outOfRangeStrong.length === 1) {
    const hasConcordance =
      concordance.hasAsymmetry ||
      concordance.hasVoiceMotorMatch ||
      concordance.hasProdromalMatch;
    resultTier = hasConcordance ? 'some_indicators_followup' : 'some_indicators_monitor';
  } else {
    resultTier = 'multiple_indicators';
  }

  return {
    resultTier,
    resultLabel: TIER_LABELS[resultTier],
    resultExplanation: TIER_EXPLANATIONS[resultTier],
    flaggedStrongTests: outOfRangeStrong.length,
    borderlineStrongTests: borderlineStrong.length,
    concordance,
    hasConcordance: concordance.hasAsymmetry || concordance.hasVoiceMotorMatch || concordance.hasProdromalMatch,
    sessionCaveats: caveats,
    retestRecommendation,
    disclaimer: DISCLAIMER,
  };
}