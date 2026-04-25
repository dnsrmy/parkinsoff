import { T, F } from '../design.js';

export default function AnalyzingScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: T.bg,
      gap: 24,
      padding: 32,
    }}>
      <div style={{ fontSize: 52, color: T.accent }}>...</div>
      <p style={{ color: T.text, fontSize: F.h3, fontWeight: 600, margin: 0, textAlign: 'center' }}>
        Analysing your results…
      </p>
      <p style={{ color: T.muted, fontSize: F.body, margin: 0, textAlign: 'center' }}>
        This may take a moment.
      </p>
    </div>
  );
}
