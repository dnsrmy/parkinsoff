import { useState, useRef, useEffect, useCallback } from 'react';
import { labelMetric, labelTest } from '../../utils/scoringEngine.js';
import { THRESHOLDS } from '../../utils/thresholds.js';

const BG       = '#E8EAF6';
const PRIMARY  = '#7C6AF7';
const CARD     = '#FFFFFF';
const TEXT     = '#1A1A2E';
const MUTED    = '#9E9EB0';

const TOTAL_TRIALS    = 10;
const STIMULUS_TIMEOUT = 2000;

const TABS = ['CONTEXT QUESTIONS', 'VOICE', 'MOTOR', 'COGNITIVE', 'TREMORS'];
const ACTIVE_TAB = 'COGNITIVE';

function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

function RedoButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 52,
        height: 54,
        borderRadius: 16,
        backgroundColor: active ? PRIMARY : '#9E9E9E',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 11a7 7 0 1 0 7-7 7 7 0 0 0-4.95 2.05" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="3,7 4,11 8,10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

function TabBar() {
  return (
    <div style={{
      backgroundColor: CARD,
      borderBottom: '1px solid #E0E0E0',
      display: 'flex',
      width: '100%',
    }}>
      {TABS.map(tab => {
        const active = tab === ACTIVE_TAB;
        return (
          <div
            key={tab}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 0 10px',
              fontSize: 10,
              fontWeight: active ? 700 : 400,
              color: active ? PRIMARY : MUTED,
              borderBottom: active ? `2px solid ${PRIMARY}` : '2px solid transparent',
              letterSpacing: '0.04em',
              userSelect: 'none',
            }}
          >
            {tab}
          </div>
        );
      })}
    </div>
  );
}

export default function ReactionTimeTest({ onComplete, onBack, onSkip, onRedo, testIndex, isOver65 = false }) {
  const [phase, setPhase] = useState('idle'); // idle | waiting | stimulus | feedback | done
  const [trialIndex, setTrialIndex] = useState(0);
  const [showStimulus, setShowStimulus] = useState(false);
  const [lastRT, setLastRT] = useState(null);
  const [lastMiss, setLastMiss] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const rtsRef          = useRef([]);
  const missesRef       = useRef(0);
  const stimulusStartRef = useRef(null);
  const timeoutRef      = useRef(null);
  const trialIndexRef   = useRef(0);
  trialIndexRef.current = trialIndex;

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const nextTrial = useCallback(() => {
    const idx = trialIndexRef.current;
    if (idx >= TOTAL_TRIALS) {
      finishTest();
      return;
    }
    setPhase('waiting');
    setShowStimulus(false);
    setLastRT(null);
    setLastMiss(false);
    const isi = 1500 + Math.random() * 2500;
    timeoutRef.current = setTimeout(() => {
      stimulusStartRef.current = Date.now();
      setShowStimulus(true);
      setPhase('stimulus');
      timeoutRef.current = setTimeout(() => {
        missesRef.current += 1;
        setShowStimulus(false);
        setLastMiss(true);
        setPhase('feedback');
        setTrialIndex(prev => prev + 1);
        timeoutRef.current = setTimeout(() => nextTrial(), 700);
      }, STIMULUS_TIMEOUT);
    }, isi);
  }, []); // eslint-disable-line

  function handleTap() {
    if (phase !== 'stimulus' || !showStimulus) return;
    clearTimeout(timeoutRef.current);
    const rt = Date.now() - stimulusStartRef.current;
    rtsRef.current.push(rt);
    setShowStimulus(false);
    setLastRT(rt);
    setLastMiss(false);
    setPhase('feedback');
    const next = trialIndexRef.current + 1;
    setTrialIndex(next);
    timeoutRef.current = setTimeout(() => nextTrial(), 700);
  }

  function finishTest() {
    const validRTs = rtsRef.current;
    const misses = missesRef.current;
    const miss_rate_pct = (misses / TOTAL_TRIALS) * 100;

    let mean_rt_ms = 0, rt_cv = 0;
    if (validRTs.length > 0) {
      mean_rt_ms = validRTs.reduce((a, b) => a + b, 0) / validRTs.length;
      rt_cv = validRTs.length >= 2 ? stdev(validRTs) / mean_rt_ms : 0;
    }

    const rawValues = { mean_rt_ms, rt_cv, miss_rate_pct, rtValues: [...validRTs] };

    const rtThreshold   = isOver65 ? THRESHOLDS.reaction_time.mean_rt_ms_over65 : THRESHOLDS.reaction_time.mean_rt_ms;
    const cvThreshold   = THRESHOLDS.reaction_time.rt_cv;
    const missThreshold = THRESHOLDS.reaction_time.miss_rate_pct;

    console.log('[ReactionTime] meanRT_ms:', mean_rt_ms.toFixed(1), 'rtCV:', rt_cv.toFixed(3),
                'missRate:', miss_rate_pct.toFixed(1), 'isOver65:', isOver65);

    const metrics = {
      mean_rt_ms:    labelMetric(mean_rt_ms, rtThreshold),
      rt_cv:         labelMetric(rt_cv, cvThreshold),
      miss_rate_pct: labelMetric(miss_rate_pct, missThreshold),
    };
    const status = labelTest(metrics);
    const result = { testId: 'reaction_time', status, metrics, rawValues, timestamp: Date.now() };
    setTestResult(result);
    setPhase('done');
  }

  function startTest() {
    setTrialIndex(0);
    rtsRef.current = [];
    missesRef.current = 0;
    setLastRT(null);
    setLastMiss(false);
    nextTrial();
  }

  function redoTest() {
    clearTimeout(timeoutRef.current);
    setPhase('idle');
    setTrialIndex(0);
    setShowStimulus(false);
    setLastRT(null);
    setLastMiss(false);
    setTestResult(null);
    rtsRef.current = [];
    missesRef.current = 0;
    if (onRedo) onRedo();
  }

  // Circle state
  let circleColor = '#B0B8C0';
  let circleContent = null;
  if (phase === 'stimulus' && showStimulus) {
    circleColor = '#1EC9A0';
    circleContent = null;
  } else if (phase === 'feedback' && lastRT != null) {
    circleColor = '#90CAFF';
    circleContent = <span style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{lastRT}ms</span>;
  } else if (phase === 'feedback' && lastMiss) {
    circleColor = '#FFBCBC';
    circleContent = <span style={{ color: '#E53935', fontSize: 18, fontWeight: 700 }}>Miss</span>;
  }

  const isActive = phase === 'waiting' || phase === 'stimulus' || phase === 'feedback';

  if (phase === 'done' && testResult) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
        <TabBar />
        <div style={{ padding: '24px 24px 100px', maxWidth: 480, margin: '0 auto' }}>
          {onBack && (
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
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Reaction Time</div>
            <div style={{ fontSize: 15, color: '#3D3D5C' }}>Test complete — all {TOTAL_TRIALS} trials done.</div>
          </div>

          <div style={{ width: '100%', backgroundColor: '#7DC95E', padding: '14px 0', textAlign: 'center',
                        fontSize: 18, fontWeight: 600, color: '#fff', borderRadius: 12, marginBottom: 24 }}>
            Test Complete
          </div>

          <div style={{ backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 24,
                        boxShadow: '0 2px 12px rgba(26,26,46,0.08)' }}>
            {[
              { label: 'Mean reaction time', value: `${Math.round(testResult.rawValues.mean_rt_ms)}ms`, metric: testResult.metrics.mean_rt_ms },
              { label: 'Consistency (CV)', value: testResult.rawValues.rt_cv.toFixed(3), metric: testResult.metrics.rt_cv },
              { label: 'Miss rate', value: `${testResult.rawValues.miss_rate_pct.toFixed(0)}%`, metric: testResult.metrics.miss_rate_pct },
            ].map(({ label, value, metric }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 0', borderTop: '1px solid #F0EFF8', fontSize: 14 }}>
                <span style={{ color: '#3D3D5C' }}>{label}</span>
                <span style={{ fontWeight: 700, color: metric === 'out_of_range' ? '#DC2626' : metric === 'borderline' ? '#D97706' : '#2D6A4F' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <RedoButton active onClick={redoTest} />
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
      <TabBar />
      <div
        style={{ padding: '24px 24px 40px', maxWidth: 480, margin: '0 auto' }}
        onPointerDown={phase === 'stimulus' ? handleTap : undefined}
      >
        {onBack && phase === 'idle' && (
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
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Reaction Time</div>
          <div style={{ fontSize: 15, color: '#3D3D5C' }}>
            Tap the circle when it turns green as quickly as possible.
          </div>
        </div>

        {isActive && (
          <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 16 }}>
            Trial {Math.min(trialIndex + 1, TOTAL_TRIALS)} of {TOTAL_TRIALS}
          </div>
        )}

        {/* Large circle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          marginBottom: 32,
        }}>
          <div style={{
            width: 260,
            height: 260,
            borderRadius: '50%',
            backgroundColor: circleColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.1s ease',
            cursor: phase === 'stimulus' ? 'pointer' : 'default',
            touchAction: 'none',
          }}>
            {circleContent}
            {phase === 'waiting' && (
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 500, opacity: 0.7 }}>Get ready...</span>
            )}
          </div>
        </div>

        {/* Bottom controls */}
        <div style={{ display: 'flex', gap: 12 }}>
          <RedoButton active={isActive} onClick={isActive ? redoTest : (onRedo || (() => {}))} />
          {phase === 'idle' && (
            <button
              onClick={startTest}
              style={{
                flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Start
            </button>
          )}
          {isActive && (
            <button
              disabled
              style={{
                flex: 1, height: 54, backgroundColor: 'transparent', color: MUTED,
                border: `1.5px solid ${MUTED}`, borderRadius: 28, fontSize: 16, fontWeight: 600,
                cursor: 'default', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Ongoing
            </button>
          )}
        </div>

        {phase === 'idle' && onSkip && (
          <button
            onClick={() => onSkip({ testId: 'reaction_time', status: 'skipped', metrics: {}, rawValues: {} })}
            style={{
              background: 'none', border: 'none', color: MUTED,
              fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              textAlign: 'center', padding: '12px 0', width: '100%', marginTop: 8,
            }}
          >
            Skip test
          </button>
        )}
      </div>
    </div>
  );
}
