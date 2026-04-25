import { useState } from 'react';
import { getAnalyses } from '../utils/storage.js';
import { FULL } from '../utils/disclaimers.js';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';

const STEPS = [
  { n: '1', label: 'Answer a few questions' },
  { n: '2', label: 'Complete movement tests' },
  { n: '3', label: 'Review your results' },
];

function TulipLogo() {
  return (
    <svg width="52" height="60" viewBox="0 0 52 60" fill="none">
      <path d="M26 32 L26 58" stroke="#7DC95E" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M26 46 Q15 42 13 32 Q21 37 26 46" fill="#7DC95E" opacity="0.85"/>
      <path d="M26 42 Q37 38 39 28 Q31 33 26 42" fill="#7DC95E" opacity="0.85"/>
      <path d="M26 10 C19 10 15 18 15 24 C15 30 19 33 26 33 C33 33 37 30 37 24 C37 18 33 10 26 10Z" fill={PRIMARY}/>
      <path d="M18 14 C11 12 8 18 8 22 C8 27 13 30 18 29 C21 27 23 31 23 31 C23 22 17 20 18 14Z" fill="#9B8FF4"/>
      <path d="M34 14 C41 12 44 18 44 22 C44 27 39 30 34 29 C31 27 29 31 29 31 C29 22 35 20 34 14Z" fill="#9B8FF4"/>
    </svg>
  );
}

export default function WelcomeScreen({ onStart, onViewDashboard }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const hasHistory = getAnalyses().length > 0;

  function handleStart() {
    onStart('');
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: BG,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px 48px',
      fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo + name */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', marginBottom: 14 }}>
            <TulipLogo />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: -0.5, marginBottom: 6 }}>
            Parkinsoff
          </div>
          <div style={{ fontSize: 15, color: '#3D3D5C', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
            Simple screening for early Parkinson's signals based on movement and speech.
          </div>
        </div>

        {/* 3-step card */}
        <div style={{
          backgroundColor: CARD, borderRadius: 16, padding: '18px 20px',
          marginBottom: 24, boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
        }}>
          {STEPS.map((step, i) => (
            <div key={step.n} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              paddingTop: i > 0 ? 12 : 0,
              paddingBottom: i < STEPS.length - 1 ? 12 : 0,
              borderBottom: i < STEPS.length - 1 ? '1px solid #F0EFF8' : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                backgroundColor: '#EDE9FF', border: `1.5px solid ${PRIMARY}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: PRIMARY, flexShrink: 0,
              }}>
                {step.n}
              </div>
              <span style={{ fontSize: 14, color: '#3D3D5C', fontWeight: 500 }}>{step.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          style={{
            width: '100%', height: 54, backgroundColor: PRIMARY, color: '#fff',
            border: 'none', borderRadius: 28, fontSize: 17, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 4px 18px rgba(123,104,238,0.30)',
            marginBottom: 16,
          }}
        >
          Start First Test
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* View history */}
        {hasHistory && (
          <button
            onClick={onViewDashboard}
            style={{
              width: '100%', height: 50, backgroundColor: 'transparent',
              color: '#3D3D5C', border: '1.5px solid #D8D6F0', borderRadius: 28,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif', marginBottom: 24,
            }}
          >
            View your history
          </button>
        )}

        {/* Footer disclaimer */}
        <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
          All data is kept on your device. For personal awareness only.{' '}
          <span
            onClick={() => setShowDisclaimer(v => !v)}
            style={{ color: PRIMARY, fontWeight: 600, cursor: 'pointer' }}
          >
            Read full disclaimer
          </span>
        </p>

        {showDisclaimer && (
          <div style={{
            marginTop: 16, backgroundColor: '#F9F8FF',
            border: '1px solid #C4B5FD', borderRadius: 12,
            padding: '18px 20px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: PRIMARY, letterSpacing: 0.6, marginBottom: 10 }}>
              MEDICAL DISCLAIMER
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#3D3D5C', lineHeight: 1.8 }}>
              {FULL}
            </p>
            <button
              onClick={() => setShowDisclaimer(false)}
              style={{
                background: 'none', border: 'none', color: PRIMARY,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif', padding: 0,
              }}
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
