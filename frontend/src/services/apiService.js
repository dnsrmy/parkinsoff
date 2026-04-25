const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function analyzeSymptoms({ symptoms, detectedSignals, severity }) {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symptoms, detectedSignals, severity }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
