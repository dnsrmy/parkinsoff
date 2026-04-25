const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function processVoiceBlob(blob, pcmStats = {}) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const res = await fetch(`${BASE_URL}/api/voice/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64, mimeType: blob.type, pcmStats }),
  });

  if (!res.ok) throw new Error(`Voice API error ${res.status}`);
  return res.json();
}
