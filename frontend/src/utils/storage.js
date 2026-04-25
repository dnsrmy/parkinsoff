const KEYS = {
  user: 'ps_user',
  analyses: 'ps_analyses',
  signalHistory: 'ps_signal_history',
  checkins: 'ps_checkins',
  xp: 'ps_xp',
};

function safeParse(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export const getUser = () => safeParse(KEYS.user, null);
export const saveUser = (user) => localStorage.setItem(KEYS.user, JSON.stringify(user));

export const getAnalyses = () => safeParse(KEYS.analyses, []);
export function saveAnalysis(analysis) {
  const all = getAnalyses();
  const entry = {
    id: analysis.id || Date.now().toString(),
    date: analysis.date || new Date().toISOString(),
    ...analysis,
  };
  all.unshift(entry); // newest first
  if (all.length > 50) all.splice(50);
  localStorage.setItem(KEYS.analyses, JSON.stringify(all));
}

export const getSignalHistory = () => safeParse(KEYS.signalHistory, {});
export function updateSignalHistory(detectedSignals = []) {
  const h = getSignalHistory();
  for (const sig of detectedSignals) h[sig] = (h[sig] || 0) + 1;
  localStorage.setItem(KEYS.signalHistory, JSON.stringify(h));
}

export const getCheckins = () => safeParse(KEYS.checkins, []);
export function saveCheckin({ date, responses }) {
  const all = getCheckins();
  const idx = all.findIndex((c) => c.date === date);
  if (idx >= 0) all[idx] = { date, responses };
  else all.push({ date, responses });
  localStorage.setItem(KEYS.checkins, JSON.stringify(all));
}

export const getXp = () => parseInt(localStorage.getItem(KEYS.xp) || '0', 10);
export const saveXp = (xp) => localStorage.setItem(KEYS.xp, String(xp));

export function clearAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export function toLocalDateStr(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function computeStreak(checkins) {
  if (!checkins || !checkins.length) return 0;
  const dates = new Set(checkins.map((c) => c.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    if (dates.has(toLocalDateStr(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}
