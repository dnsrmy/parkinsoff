import { useState, useRef, useEffect, useCallback } from 'react';
import { THRESHOLDS } from '../../utils/thresholds.js';
import { labelMetric, labelTest } from '../../utils/scoringEngine.js';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';
const GREEN   = '#7DC95E';
const TAP_L        = '#5B9FE0';
const TAP_R        = '#4BC6B9';
const TAP_L_ACTIVE = '#2472E0';
const TAP_R_ACTIVE = '#2BBDB0';

const TABS       = ['CONTEXT QUESTIONS', 'VOICE', 'MOTOR', 'COGNITIVE', 'TREMORS'];
const ACTIVE_TAB = 'MOTOR';
const PER_HAND   = 10;

function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

function computeHandMetrics(timestamps) {
  if (timestamps.length < 3) return null;
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i] - timestamps[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const cv = mean > 0 ? stdev(intervals) / mean : 0;
  return { mean_intertap_ms: mean, interval_cv: cv, intervals };
}

function TabBar() {
  return (
    <div style={{ backgroundColor: CARD, borderBottom: '1px solid #E0E0E0', display: 'flex', width: '100%' }}>
      {TABS.map(tab => {
        const active = tab === ACTIVE_TAB;
        return (
          <div key={tab} style={{
            flex: 1, textAlign: 'center', padding: '12px 0 10px',
            fontSize: 10, fontWeight: active ? 700 : 400,
            color: active ? PRIMARY : MUTED,
            borderBottom: active ? `2px solid ${PRIMARY}` : '2px solid transparent',
            letterSpacing: '0.04em', userSelect: 'none',
          }}>
            {tab}
          </div>
        );
      })}
    </div>
  );
}

function RedoButton({ active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 52, height: 54, borderRadius: 16,
      backgroundColor: active ? PRIMARY : '#9E9E9E',
      border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 11a7 7 0 1 0 7-7 7 7 0 0 0-4.95 2.05" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="3,7 4,11 8,10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

export default function FingerTappingTest({ onComplete, onSkip, onBack, onRedo, testIndex }) {
  const [phase, setPhase]         = useState('idle'); // idle | dominant | switch_prompt | nondominant | done
  const [elapsed, setElapsed]     = useState(0);
  const [tapCount, setTapCount]   = useState(0);
  const [lastTapped, setLastTapped] = useState(null); // 'L' | 'R' | null
  const [testResult, setTestResult] = useState(null);

  const dominantTimestamps    = useRef([]);
  const nonDominantTimestamps = useRef([]);
  const timerRef  = useRef(null);
  const flashRef  = useRef(null);
  const phaseRef  = useRef('idle');

  phaseRef.current = phase;

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(flashRef.current);
  }, []);

  const startPhase = useCallback((phaseName) => {
    setPhase(phaseName);
    setElapsed(0);
    setTapCount(0);
    setLastTapped(null);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const e = Math.floor((Date.now() - start) / 1000);
      setElapsed(e);
      if (e >= PER_HAND) {
        clearInterval(timerRef.current);
        if (phaseName === 'dominant') {
          setPhase('switch_prompt');
        } else {
          finishTest();
        }
      }
    }, 200);
  }, []); // eslint-disable-line

  function handleTap(side) {
    const now = Date.now();
    const ph  = phaseRef.current;
    if (ph === 'dominant' && side === 'R') {
      dominantTimestamps.current.push(now);
      setTapCount(dominantTimestamps.current.length);
    } else if (ph === 'nondominant' && side === 'L') {
      nonDominantTimestamps.current.push(now);
      setTapCount(nonDominantTimestamps.current.length);
    } else {
      return;
    }
    setLastTapped(side);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setLastTapped(null), 150);
  }

  function finishTest() {
    const domMetrics    = computeHandMetrics(dominantTimestamps.current);
    const nonDomMetrics = computeHandMetrics(nonDominantTimestamps.current);
    const rawValues = {};
    const metrics   = {};

    if (domMetrics) {
      rawValues.mean_intertap_ms    = domMetrics.mean_intertap_ms;
      rawValues.interval_cv         = domMetrics.interval_cv;
      rawValues.dominantIntervals   = domMetrics.intervals;
      metrics.mean_intertap_ms      = labelMetric(domMetrics.mean_intertap_ms, THRESHOLDS.finger_tapping.mean_intertap_ms);
      metrics.interval_cv           = labelMetric(domMetrics.interval_cv,      THRESHOLDS.finger_tapping.interval_cv);
    } else {
      metrics.mean_intertap_ms = 'unknown';
      metrics.interval_cv      = 'unknown';
    }

    if (nonDomMetrics) {
      rawValues.nondominantIntervals = nonDomMetrics.intervals;
    }

    if (domMetrics && nonDomMetrics) {
      const avg = (domMetrics.mean_intertap_ms + nonDomMetrics.mean_intertap_ms) / 2;
      const lrAsymmetry = avg > 0
        ? Math.abs(domMetrics.mean_intertap_ms - nonDomMetrics.mean_intertap_ms) / avg
        : 0;
      rawValues.lr_asymmetry = lrAsymmetry;
      metrics.lr_asymmetry   = labelMetric(lrAsymmetry, THRESHOLDS.finger_tapping.lr_asymmetry);
    } else {
      metrics.lr_asymmetry = 'unknown';
    }

    console.log('[FingerTapping] domTaps:', dominantTimestamps.current.length,
                'nonDomTaps:', nonDominantTimestamps.current.length,
                'meanITI_ms:', domMetrics?.mean_intertap_ms?.toFixed(1),
                'cv:', domMetrics?.interval_cv?.toFixed(3));

    const status = labelTest(metrics);
    const result = { testId: 'finger_tapping', status, metrics, rawValues, timestamp: Date.now() };
    setTestResult(result);
    setPhase('done');
  }

  function redoTest() {
    clearInterval(timerRef.current);
    clearTimeout(flashRef.current);
    dominantTimestamps.current    = [];
    nonDominantTimestamps.current = [];
    setPhase('idle');
    setElapsed(0);
    setTapCount(0);
    setLastTapped(null);
    setTestResult(null);
    if (onRedo) onRedo();
  }

  const isRecording = phase === 'dominant' || phase === 'nondominant';
  const isDone      = phase === 'done';

  const lColor = lastTapped === 'L' ? TAP_L_ACTIVE : TAP_L;
  const rColor = lastTapped === 'R' ? TAP_R_ACTIVE : TAP_R;

  const title = phase === 'nondominant'
    ? 'Left Index Finger Tapping'
    : 'Right Index Finger Tapping';

  const subtitle = phase === 'idle'
    ? 'Tap the right (R) box with your right index finger as fast as possible for 10 seconds.'
    : phase === 'switch_prompt'
    ? 'Right hand complete! Tap "Next Finger" to continue with your left hand.'
    : phase === 'nondominant'
    ? 'Tap the left (L) box with your left index finger as fast as possible.'
    : isDone
    ? 'Both hands recorded. Review your results below.'
    : 'Tap as fast and regularly as you can.';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
      <TabBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 480, margin: '0 auto', userSelect: 'none' }}>

        {/* Return button */}
        {onBack && (phase === 'idle' || phase === 'done') && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: MUTED, fontSize: 14,
              cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              padding: '4px 0', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Return
          </button>
        )}

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 15, color: '#3D3D5C', lineHeight: 1.5 }}>{subtitle}</div>
        </div>

        {/* Test Complete banner */}
        {isDone && (
          <div style={{
            backgroundColor: GREEN, borderRadius: 10, padding: '12px 0',
            textAlign: 'center', fontSize: 17, fontWeight: 600, color: '#fff', marginBottom: 16,
          }}>
            Test Complete
          </div>
        )}

        {/* Switch prompt banner */}
        {phase === 'switch_prompt' && (
          <div style={{
            backgroundColor: GREEN, borderRadius: 10, padding: '12px 16px',
            textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 16,
          }}>
            Right hand done!
          </div>
        )}

        {/* Two tap boxes */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div
            onPointerDown={(e) => { e.preventDefault(); handleTap('L'); }}
            style={{
              flex: 1, height: 280, backgroundColor: lColor, borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 72, fontWeight: 800, color: '#fff',
              cursor: phase === 'nondominant' ? 'pointer' : 'default',
              touchAction: 'none',
              opacity: (phase === 'idle' || phase === 'dominant' || phase === 'done') ? 0.65 : 1,
              transition: 'background-color 0.08s, opacity 0.2s',
            }}
          >
            L
          </div>
          <div
            onPointerDown={(e) => { e.preventDefault(); handleTap('R'); }}
            style={{
              flex: 1, height: 280, backgroundColor: rColor, borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 72, fontWeight: 800, color: '#fff',
              cursor: phase === 'dominant' ? 'pointer' : 'default',
              touchAction: 'none',
              opacity: (phase === 'idle' || phase === 'nondominant' || phase === 'done') ? 0.65 : 1,
              transition: 'background-color 0.08s, opacity 0.2s',
            }}
          >
            R
          </div>
        </div>

        {/* Status row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRecording ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E53935' }} />
                <span style={{ fontSize: 14, color: '#E53935', fontWeight: 600 }}>
                  Recording · {tapCount} taps
                </span>
              </>
            ) : (
              <>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: MUTED }} />
                <span style={{ fontSize: 14, color: MUTED }}>
                  {isDone ? 'Recording Complete' : 'Recording Paused'}
                </span>
              </>
            )}
          </div>
          <div style={{
            border: `1.5px solid ${PRIMARY}`, borderRadius: 20,
            padding: '3px 12px', fontSize: 13, fontWeight: 600, color: PRIMARY,
          }}>
            {elapsed}s / {PER_HAND}s
          </div>
        </div>

        {/* Progress bar when recording */}
        {isRecording && (
          <div style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', width: `${Math.min(100, (elapsed / PER_HAND) * 100)}%`,
              backgroundColor: GREEN, borderRadius: 2, transition: 'width 0.2s linear',
            }} />
          </div>
        )}

        {/* Result card when done */}
        {isDone && testResult && (
          <div style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16,
                        boxShadow: '0 2px 8px rgba(26,26,46,0.06)' }}>
            {[
              {
                label: 'Mean inter-tap interval',
                value: testResult.rawValues.mean_intertap_ms != null
                  ? `${Math.round(testResult.rawValues.mean_intertap_ms)}ms`
                  : '—',
                metric: testResult.metrics.mean_intertap_ms,
              },
              {
                label: 'Rhythm consistency (CV)',
                value: testResult.rawValues.interval_cv != null
                  ? testResult.rawValues.interval_cv.toFixed(3)
                  : '—',
                metric: testResult.metrics.interval_cv,
              },
              {
                label: 'L/R asymmetry',
                value: testResult.rawValues.lr_asymmetry != null
                  ? testResult.rawValues.lr_asymmetry.toFixed(3)
                  : '—',
                metric: testResult.metrics.lr_asymmetry,
              },
            ].map(({ label, value, metric }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderTop: '1px solid #F0EFF8', fontSize: 14,
              }}>
                <span style={{ color: '#3D3D5C' }}>{label}</span>
                <span style={{
                  fontWeight: 700,
                  color: metric === 'out_of_range' ? '#DC2626' : metric === 'borderline' ? '#D97706' : '#2D6A4F',
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <RedoButton active={isRecording || isDone} onClick={redoTest} />

          {phase === 'idle' && (
            <button
              onPointerDown={(e) => { e.preventDefault(); startPhase('dominant'); }}
              style={{
                flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Start
            </button>
          )}

          {isRecording && (
            <button disabled style={{
              flex: 1, height: 54, backgroundColor: 'transparent', color: MUTED,
              border: `1.5px solid ${MUTED}`, borderRadius: 28, fontSize: 16,
              cursor: 'default', fontFamily: 'system-ui, sans-serif',
            }}>
              Ongoing
            </button>
          )}

          {phase === 'switch_prompt' && (
            <button
              onPointerDown={(e) => { e.preventDefault(); startPhase('nondominant'); }}
              style={{
                flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Next Finger
            </button>
          )}

          {isDone && (
            <button
              onClick={() => onComplete(testResult)}
              style={{
                flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Continue
            </button>
          )}
        </div>

        {phase === 'idle' && onSkip && (
          <button
            onClick={() => onSkip({ testId: 'finger_tapping', status: 'skipped', metrics: {}, rawValues: {} })}
            style={{
              background: 'none', border: 'none', color: MUTED, fontSize: 14,
              cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              textAlign: 'center', padding: '12px 0', width: '100%', marginTop: 4,
            }}
          >
            Skip test
          </button>
        )}

      </div>
    </div>
  );
}
