import { useState } from 'react';
import { getUser, saveUser } from '../utils/storage.js';
import MedicalDisclaimer from '../components/MedicalDisclaimer.jsx';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';

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

const STEPS = [
  { n: '1', label: 'Tell us what you\'ve noticed' },
  { n: '2', label: 'Complete a quick movement test' },
  { n: '3', label: 'Review your result' },
];

function NameInput({ label, value, onChange, placeholder, onKeyDown }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 14, fontWeight: 600,
        color: '#3D3D5C', marginBottom: 8,
      }}>
        {label}
      </label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'block', width: '100%', boxSizing: 'border-box',
          backgroundColor: CARD, color: TEXT,
          border: `1.5px solid ${focused ? PRIMARY : '#D8D6F0'}`,
          borderRadius: 12, padding: '14px 18px',
          fontSize: 16, outline: 'none',
          fontFamily: 'system-ui, sans-serif',
          transition: 'border-color 0.15s', height: 54,
        }}
      />
    </div>
  );
}

export default function LandingScreen({ hasHistory, onStart, onReturn }) {
  const [name, setName] = useState(() => {
    const saved = getUser();
    return saved?.name || '';
  });
  const [familyHistory, setFamilyHistory] = useState(() => {
    const saved = getUser();
    return saved?.familyHistory || false;
  });
  const [nameError, setNameError] = useState('');

  const savedUser = getUser();

  function handleBegin() {
    if (!name.trim()) { setNameError('Please enter your name to continue.'); return; }
    setNameError('');
    const user = {
      name: name.trim(),
      familyHistory,
      createdAt: savedUser?.createdAt || new Date().toISOString(),
    };
    saveUser(user);
    onStart(user);
  }

  function handleReturn() {
    if (!name.trim()) { setNameError('Please enter your name to continue.'); return; }
    setNameError('');
    const existing = getUser();
    const user = { ...(existing || {}), name: name.trim(), familyHistory };
    saveUser(user);
    onReturn(user);
  }

  // Returning user layout
  if (hasHistory && savedUser) {
    return (
      <div style={{
        minHeight: '100dvh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 24px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', marginBottom: 16 }}>
              <TulipLogo />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 1.2, marginBottom: 8 }}>
              CARE SHORTCUT
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>
              Welcome back,{' '}
              <span style={{ color: PRIMARY }}>{savedUser.name}</span>
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: '#3D3D5C', lineHeight: 1.7 }}>
              Ready to continue your awareness journey?
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button
              onClick={() => onStart(savedUser)}
              style={{
                width: '100%', height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.8"/>
                <path d="M9 5v4l2.5 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Take new assessment
            </button>
            <button
              onClick={() => onReturn(savedUser)}
              style={{
                width: '100%', height: 54, backgroundColor: 'transparent', color: '#3D3D5C',
                border: '1.5px solid #D8D6F0', borderRadius: 28, fontSize: 16, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              View my dashboard
            </button>
          </div>

          <div style={{ marginTop: 40, borderTop: '1px solid #D8D6F0', paddingTop: 20 }}>
            <MedicalDisclaimer compact />
          </div>
        </div>
      </div>
    );
  }

  // New user layout
  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px 48px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo + headline */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', marginBottom: 16 }}>
            <TulipLogo />
          </div>
          <h1 style={{
            margin: '0 0 10px', fontSize: 28, fontWeight: 800, color: TEXT,
            lineHeight: 1.2, letterSpacing: -0.5,
          }}>
            Parkinsoff
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#3D3D5C', lineHeight: 1.7 }}>
            Simple screening for early Parkinson's signals based on family history and symptoms.
          </p>
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

        {/* Form card */}
        <div style={{
          backgroundColor: CARD, borderRadius: 16, padding: 24,
          marginBottom: 20, boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: TEXT }}>
            Begin your assessment
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: MUTED, lineHeight: 1.7 }}>
            No account needed. All data stays on your device.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <NameInput
                label="Your name"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); }}
                placeholder="Enter your first name"
                onKeyDown={(e) => e.key === 'Enter' && handleBegin()}
              />
              {nameError && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
                  {nameError}
                </p>
              )}
            </div>

            {/* Family history toggle */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer',
              padding: '14px 16px', borderRadius: 12,
              border: `1.5px solid ${familyHistory ? PRIMARY : '#D8D6F0'}`,
              backgroundColor: familyHistory ? '#EDE9FF' : BG,
              transition: 'all 0.15s',
            }}>
              <div
                style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  border: `2px solid ${familyHistory ? PRIMARY : '#C4B5FD'}`,
                  backgroundColor: familyHistory ? PRIMARY : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                onClick={() => setFamilyHistory(prev => !prev)}
              >
                {familyHistory && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}>
                  Family history of Parkinson's disease
                </div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>
                  Helps contextualize your awareness profile
                </div>
              </div>
            </label>

            <button
              onClick={handleBegin}
              style={{
                width: '100%', height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Start First Test
            </button>
          </div>
        </div>

        {/* Returning user link */}
        <div style={{
          textAlign: 'center', padding: '16px', backgroundColor: CARD,
          border: '1px solid #E8E0FF', borderRadius: 12, marginBottom: 28,
          boxShadow: '0 1px 6px rgba(26,26,46,0.06)',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: MUTED, lineHeight: 1.7 }}>
            Already have results?
          </p>
          <button
            onClick={handleReturn}
            style={{
              background: 'none', border: 'none', color: PRIMARY, fontSize: 14,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              padding: '8px 0', minHeight: 44, textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            View dashboard
          </button>
        </div>

        <MedicalDisclaimer compact />
      </div>
    </div>
  );
}
