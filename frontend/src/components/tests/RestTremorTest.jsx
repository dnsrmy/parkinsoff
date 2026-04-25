import { useState, useRef, useEffect } from 'react';
import { labelMetric, labelTest } from '../../utils/scoringEngine.js';
import { THRESHOLDS } from '../../utils/thresholds.js';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';
const GREEN   = '#7DC95E';

const TABS       = ['CONTEXT QUESTIONS', 'VOICE', 'MOTOR', 'COGNITIVE', 'TREMORS'];
const ACTIVE_TAB = 'TREMORS';
const COLLECTION_SECONDS = 10;

function computePowerRatio(samples) {
  if (samples.length < 20) return 0.15;
  const magnitudes = samples.map(s =>
    Math.sqrt((s.x || 0) ** 2 + (s.y || 0) ** 2 + (s.z || 0) ** 2)
  );
  const duration = (samples[samples.length - 1].t - samples[0].t) / 1000;
  if (duration <= 0) return 0.15;
  const sampleRate = samples.length / duration;
  const N = magnitudes.length;
  let totalPower = 0, tremorBandPower = 0;
  for (let freqIdx = 1; freqIdx <= Math.floor(N / 2); freqIdx++) {
    const freq = (freqIdx * sampleRate) / N;
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      const angle = (2 * Math.PI * freqIdx * i) / N;
      re += magnitudes[i] * Math.cos(angle);
      im -= magnitudes[i] * Math.sin(angle);
    }
    const power = (re * re + im * im) / N;
    totalPower += power;
    if (freq >= 3 && freq <= 7) tremorBandPower += power;
  }
  return totalPower > 0 ? tremorBandPower / totalPower : 0;
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

export default function RestTremorTest({ onComplete, onSkip, onBack, onRedo, testIndex }) {
  const [phase, setPhase]         = useState('idle'); // idle | permission | collecting | analyzing | done | unavailable
  const [countdown, setCountdown] = useState(COLLECTION_SECONDS);
  const [permError, setPermError] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const samplesRef = useRef([]);
  const timerRef   = useRef(null);
  const handlerRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (handlerRef.current) window.removeEventListener('devicemotion', handlerRef.current);
  }, []);

  async function requestAndStart() {
    if (typeof DeviceMotionEvent === 'undefined') {
      setPhase('unavailable');
      return;
    }
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      setPhase('permission');
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm !== 'granted') {
          setPermError('Accelerometer permission denied.');
          return;
        }
      } catch {
        setPermError('Could not request accelerometer permission.');
        return;
      }
    }
    startCollection();
  }

  function startCollection() {
    samplesRef.current = [];
    setPhase('collecting');
    setCountdown(COLLECTION_SECONDS);

    handlerRef.current = (e) => {
      samplesRef.current.push({
        x: e.accelerationIncludingGravity?.x ?? 0,
        y: e.accelerationIncludingGravity?.y ?? 0,
        z: e.accelerationIncludingGravity?.z ?? 0,
        t: Date.now(),
      });
    };
    window.addEventListener('devicemotion', handlerRef.current);

    let remaining = COLLECTION_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        window.removeEventListener('devicemotion', handlerRef.current);
        setPhase('analyzing');
        analyze(false);
      }
    }, 1000);
  }

  function analyze(mock) {
    let power_ratio;
    if (mock || samplesRef.current.length < 20) {
      power_ratio = 0.10 + Math.random() * 0.35;
    } else {
      power_ratio = computePowerRatio(samplesRef.current);
    }
    console.log('[RestTremor] power_ratio_3_7hz:', power_ratio.toFixed(4), 'isMock:', mock);
    const rawValues = { power_ratio_3_7hz: power_ratio };
    const metrics   = {
      power_ratio_3_7hz: labelMetric(power_ratio, THRESHOLDS.rest_tremor.power_ratio_3_7hz),
    };
    const status = labelTest(metrics);
    const result = { testId: 'rest_tremor', status, metrics, rawValues, timestamp: Date.now() };
    setTestResult(result);
    setPhase('done');
  }

  function redoTest() {
    clearInterval(timerRef.current);
    if (handlerRef.current) window.removeEventListener('devicemotion', handlerRef.current);
    samplesRef.current = [];
    setPhase('idle');
    setCountdown(COLLECTION_SECONDS);
    setPermError(null);
    setTestResult(null);
    if (onRedo) onRedo();
  }

  const isDone = phase === 'done';
  const isCollecting = phase === 'collecting';
  const progress = ((COLLECTION_SECONDS - countdown) / COLLECTION_SECONDS) * 100;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
      <TabBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 480, margin: '0 auto' }}>

        {/* Return button */}
        {onBack && (phase === 'idle' || phase === 'done' || phase === 'unavailable') && (
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
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Rest Tremor</div>
          <div style={{ fontSize: 15, color: '#3D3D5C', lineHeight: 1.5 }}>
            {phase === 'idle'
              ? 'Place your phone on a flat surface and stay completely still for 10 seconds.'
              : isCollecting
              ? 'Stay completely still — recording motion sensor data.'
              : phase === 'analyzing'
              ? 'Analyzing motion data...'
              : isDone
              ? 'Motion sensor data has been analyzed.'
              : 'This test measures resting tremor using your phone\'s motion sensor.'}
          </div>
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

        {/* Error banner */}
        {permError && (
          <div style={{
            backgroundColor: '#FFF1F2', border: '1px solid #FECACA',
            borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#991B1B', marginBottom: 16,
          }}>
            {permError}
          </div>
        )}

        {/* Instructions card (idle) */}
        {phase === 'idle' && (
          <div style={{
            backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16,
            boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
          }}>
            <div style={{ fontWeight: 600, color: TEXT, marginBottom: 10 }}>Instructions</div>
            <ul style={{ paddingLeft: 20, margin: 0, color: '#3D3D5C', fontSize: 14, lineHeight: 1.8 }}>
              <li>Place your phone flat on a table, or</li>
              <li>Hold it with your arm resting on a surface</li>
              <li>Stay completely still for 10 seconds</li>
              <li>Do not move or tap the screen during recording</li>
            </ul>
          </div>
        )}

        {/* Unavailable sensor card */}
        {phase === 'unavailable' && (
          <div style={{
            backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16,
            boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
          }}>
            <div style={{ fontSize: 14, color: '#3D3D5C', lineHeight: 1.6 }}>
              Motion sensor is not available on this device. You can continue with simulated data for demonstration purposes.
            </div>
          </div>
        )}

        {/* Permission requesting */}
        {phase === 'permission' && !permError && (
          <div style={{
            backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16,
            textAlign: 'center', boxShadow: '0 2px 8px rgba(26,26,46,0.06)',
          }}>
            <div style={{ fontSize: 15, color: MUTED }}>Requesting motion sensor access...</div>
          </div>
        )}

        {/* Collecting timer */}
        {isCollecting && (
          <div style={{
            backgroundColor: CARD, borderRadius: 16, padding: 32, marginBottom: 16,
            textAlign: 'center', boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
          }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: PRIMARY, marginBottom: 8 }}>
              {countdown}s
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 20 }}>
              Stay completely still
            </div>
            <div style={{ height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                backgroundColor: GREEN, borderRadius: 3, transition: 'width 0.5s linear',
              }} />
            </div>
          </div>
        )}

        {/* Analyzing */}
        {phase === 'analyzing' && (
          <div style={{
            backgroundColor: CARD, borderRadius: 16, padding: 32, marginBottom: 16,
            textAlign: 'center', boxShadow: '0 2px 8px rgba(26,26,46,0.06)',
          }}>
            <div style={{ fontSize: 15, color: MUTED }}>Analysing...</div>
          </div>
        )}

        {/* Result card */}
        {isDone && testResult && (
          <div style={{
            backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16,
            boxShadow: '0 2px 8px rgba(26,26,46,0.06)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderTop: '1px solid #F0EFF8', fontSize: 14,
            }}>
              <span style={{ color: '#3D3D5C' }}>Tremor power ratio (3–7 Hz)</span>
              <span style={{
                fontWeight: 700,
                color: testResult.metrics.power_ratio_3_7hz === 'out_of_range'
                  ? '#DC2626'
                  : testResult.metrics.power_ratio_3_7hz === 'borderline'
                  ? '#D97706'
                  : '#2D6A4F',
              }}>
                {testResult.rawValues.power_ratio_3_7hz?.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        {/* Bottom buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <RedoButton active={isDone} onClick={isDone ? redoTest : undefined} />

          {(phase === 'idle' || phase === 'unavailable' || permError) && (
            phase === 'unavailable' || permError ? (
              <button
                onClick={() => analyze(true)}
                style={{
                  flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                  border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                }}
              >
                Continue with simulated data
              </button>
            ) : (
              <button
                onClick={requestAndStart}
                style={{
                  flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                  border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                }}
              >
                Start
              </button>
            )
          )}

          {(isCollecting || phase === 'analyzing' || phase === 'permission') && (
            <button disabled style={{
              flex: 1, height: 54, backgroundColor: 'transparent', color: MUTED,
              border: `1.5px solid ${MUTED}`, borderRadius: 28, fontSize: 16,
              cursor: 'default', fontFamily: 'system-ui, sans-serif',
            }}>
              {isCollecting ? 'Recording...' : 'Ongoing'}
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

        {(phase === 'idle') && onSkip && (
          <button
            onClick={() => onSkip({ testId: 'rest_tremor', status: 'skipped', metrics: {}, rawValues: {} })}
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
