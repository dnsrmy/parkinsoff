// Legacy scoring helpers — superseded by scoringEngine.js + thresholds.js
// Kept because App.jsx legacy flow (handleTestSubmit) still references them.

export function analyzeTestResults(testData) {
  return {
    signals: [],
    signalDetails: {},
    score: 0,
    severity: 'low',
    testBreakdown: {},
  };
}

export function buildSymptomsText(testData, signals) {
  return signals.length > 0 ? signals.join(', ') : 'No significant signals detected';
}
