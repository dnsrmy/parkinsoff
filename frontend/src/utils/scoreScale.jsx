import { useState, useEffect } from 'react';

const TRACK_COLOR = '#E8EAF6';
const TICK_LABELS = [
  { pos: 0,   label: '0' },
  { pos: 33,  label: '33' },
  { pos: 66,  label: '66' },
  { pos: 100, label: '100' },
];

function barColor(score) {
  if (score <= 33) return '#059669';
  if (score <= 66) return '#D97706';
  return '#DC2626';
}

export function ScoreScaleBar({ score }) {
  const [width, setWidth] = useState(0);
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = barColor(pct);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#64748B' }}>Signal index</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct}</span>
      </div>
      <div style={{ height: 8, backgroundColor: TRACK_COLOR, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', backgroundColor: color,
          borderRadius: 10, width: `${width}%`,
          transition: 'width 0.8s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {TICK_LABELS.map(({ pos, label }) => (
          <span key={pos} style={{ fontSize: 10, color: '#94A3B8' }}>{label}</span>
        ))}
      </div>
    </div>
  );
}
