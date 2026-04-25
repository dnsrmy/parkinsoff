import { T, F } from '../design.js';

export default function DisclaimerBlock({ screen }) {
  return (
    <div style={{
      backgroundColor: T.amberBg,
      border: `1.5px solid ${T.amberBorder}`,
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{
        fontSize: F.small,
        fontWeight: 700,
        color: T.amber,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        Medical Disclaimer
      </div>
      <p style={{
        margin: 0,
        fontSize: F.caption,
        color: '#78350F',
        lineHeight: 1.65,
      }}>
        This tool is for personal awareness only and does not constitute a medical diagnosis.
        Results may be affected by device quality, fatigue, or testing conditions.{' '}
        {screen === 'results' || screen === 'export'
          ? 'Always consult a qualified neurologist or movement disorder specialist before drawing any conclusions about your health.'
          : 'If you have concerns about your neurological health, please seek professional medical advice.'}
      </p>
    </div>
  );
}
