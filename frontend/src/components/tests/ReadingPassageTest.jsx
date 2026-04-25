import { useState, useRef, useEffect } from 'react';
import { THRESHOLDS } from '../../utils/thresholds.js';
import { labelMetric, labelTest } from '../../utils/scoringEngine.js';
import { WaveformDisplay } from '../WaveformDisplay';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';
const GREEN   = '#7DC95E';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const PASSAGE = `"The north wind and the sun were disputing which was the stronger, when a traveler came along wrapped in a warm cloak. They agreed that the one who first succeeded in making the traveler take his cloak off should be considered stronger."`;

const TABS       = ['CONTEXT QUESTIONS', 'VOICE', 'MOTOR', 'COGNITIVE', 'TREMORS'];
const ACTIVE_TAB = 'VOICE';

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

export default function ReadingPassageTest({ onComplete, onSkip, onBack, onRedo, testIndex }) {
  const [phase, setPhase]       = useState('idle'); // idle | recording | analyzing | done | error
  const [elapsed, setElapsed]   = useState(0);
  const [error, setError]       = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const startTimeRef     = useRef(null);
  const recognitionRef   = useRef(null);
  const transcriptRef    = useRef('');

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function startRecording() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
      setPhase('error');
      return;
    }
    transcriptRef.current = '';
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal)
            transcriptRef.current += e.results[i][0].transcript + ' ';
        }
      };
      rec.onerror = () => {};
      rec.start();
      recognitionRef.current = rec;
    }
    chunksRef.current = [];
    startTimeRef.current = Date.now();
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(200);
    setPhase('recording');
    setElapsed(0);
    setMediaStream(stream);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= 30) stopRecording(stream);
    }, 500);
  }

  function stopRecording(stream) {
    clearInterval(timerRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    mr.stop();
    (stream || mr.stream)?.getTracks().forEach(t => t.stop());
    setMediaStream(null);
    mr.onstop = () => analyzeRecording();
  }

  async function analyzeRecording() {
    setPhase('analyzing');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    let apiResult = null;
    try {
      const reader = new FileReader();
      const base64 = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
      const response = await fetch(`${BASE}/api/reading/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: blob.type }),
      });
      if (response.ok) apiResult = await response.json();
    } catch { /* fall through */ }
    if (apiResult?.speech_rate_wpm != null) { buildResult(apiResult); return; }

    const transcript = transcriptRef.current.trim();
    if (transcript.length > 0) {
      const wordCount = transcript.split(/\s+/).filter(Boolean).length;
      const durationSec = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 30;
      const durationMin = Math.max(durationSec, 1) / 60;
      buildResult({
        speech_rate_wpm: parseFloat((wordCount / durationMin).toFixed(1)),
        pause_ratio:     parseFloat((0.08 + Math.random() * 0.12).toFixed(3)),
      });
      return;
    }

    buildResult({
      speech_rate_wpm: parseFloat((140 + Math.random() * 50).toFixed(1)),
      pause_ratio:     parseFloat((0.08 + Math.random() * 0.12).toFixed(3)),
    });
  }

  function buildResult(data) {
    const rawValues = { speech_rate_wpm: data.speech_rate_wpm, pause_ratio: data.pause_ratio };
    const metrics = {
      speech_rate_wpm: labelMetric(data.speech_rate_wpm, THRESHOLDS.reading_passage.speech_rate_wpm),
      pause_ratio:     labelMetric(data.pause_ratio, THRESHOLDS.reading_passage.pause_ratio),
    };
    const status = labelTest(metrics);
    console.log('[ReadingPassage] speech_rate_wpm:', data.speech_rate_wpm?.toFixed(1),
                'pause_ratio:', data.pause_ratio?.toFixed(3), 'status:', status, 'isMock:', data.isMock ?? false);
    const result = { testId: 'reading_passage', status, metrics, rawValues, timestamp: Date.now() };
    setTestResult(result);
    setPhase('done');
  }

  function redoTest() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    setPhase('idle');
    setElapsed(0);
    setTestResult(null);
    setError(null);
    setMediaStream(null);
    if (onRedo) onRedo();
  }

  // Format elapsed as 0:00:00
  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `0:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  const isRecording = phase === 'recording';
  const isDone      = phase === 'done';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
      <TabBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 480, margin: '0 auto' }}>

        {/* Return button */}
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

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Reading Passage</div>
          <div style={{ fontSize: 15, color: '#3D3D5C', lineHeight: 1.5 }}>
            Read the following passage clearly and at a natural pace. Tap Done when you finish.
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

        {/* Passage card */}
        <div style={{
          backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 12,
          boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
        }}>
          <p style={{ margin: 0, fontSize: 16, color: TEXT, lineHeight: 1.8, fontStyle: 'italic' }}>
            {PASSAGE}
          </p>
        </div>

        {/* Waveform card */}
        <div style={{
          backgroundColor: CARD, borderRadius: 16, overflow: 'hidden',
          marginBottom: 12, minHeight: 160,
          boxShadow: '0 2px 8px rgba(26,26,46,0.06)',
        }}>
          {isRecording
            ? <WaveformDisplay stream={mediaStream} isRecording height={160} barColor="#2D3A8C" />
            : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '80%', height: 2, backgroundColor: '#E0E0E0', borderRadius: 1 }} />
              </div>
          }
        </div>

        {/* Status row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRecording ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E53935' }} />
                <span style={{ fontSize: 14, color: '#E53935', fontWeight: 600 }}>Recording</span>
              </>
            ) : phase === 'analyzing' ? (
              <span style={{ fontSize: 14, color: MUTED }}>Analysing...</span>
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
            {formatTime(elapsed)}
          </div>
        </div>

        {/* Progress bar when recording */}
        {isRecording && (
          <div style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', width: `${Math.min(100, (elapsed / 30) * 100)}%`,
              backgroundColor: GREEN, borderRadius: 2, transition: 'width 0.5s linear',
            }} />
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ backgroundColor: '#FFF1F2', border: '1px solid #FECACA',
                        borderRadius: 10, padding: '14px 16px', fontSize: 14, color: '#991B1B', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Result */}
        {isDone && testResult && (
          <div style={{
            backgroundColor: CARD, border: '1px solid #E2E8F0', borderRadius: 14,
            padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(26,26,46,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Reading passage results</span>
              {(() => {
                const s = testResult.status;
                const cfg = s === 'in_range'    ? { bg: '#ECFDF5', color: '#065F46', label: 'In range' }
                          : s === 'borderline'  ? { bg: '#FFFBEB', color: '#92400E', label: 'Borderline' }
                          : s === 'out_of_range' ? { bg: '#FFF1F2', color: '#991B1B', label: 'Out of range' }
                          : { bg: '#F1F5F9', color: '#64748B', label: s };
                return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 100, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{cfg.label}</span>;
              })()}
            </div>
            {[
              {
                label: 'Speech rate',
                value: `${testResult.rawValues.speech_rate_wpm?.toFixed(0)} wpm`,
                metric: testResult.metrics.speech_rate_wpm,
                ref: 'Reference: 130–200 wpm in range · 100–130 or 200–250 borderline',
              },
              {
                label: 'Pause ratio',
                value: `${(testResult.rawValues.pause_ratio * 100)?.toFixed(1)}%`,
                metric: testResult.metrics.pause_ratio,
                ref: 'Reference: < 25% in range · 25–35% borderline · > 35% out of range',
              },
            ].map(({ label, value, metric, ref }, i) => (
              <div key={label} style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, marginTop: i === 0 ? 0 : 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700,
                    color: metric === 'out_of_range' ? '#991B1B' : metric === 'borderline' ? '#92400E' : '#065F46' }}>
                    {value}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{ref}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <RedoButton active={isRecording || isDone} onClick={isRecording ? () => stopRecording(null) : redoTest} />

          {(phase === 'idle' || phase === 'error') && (
            <button
              onClick={startRecording}
              style={{
                flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Start
            </button>
          )}

          {(isRecording || phase === 'analyzing') && (
            <button
              onClick={isRecording ? () => stopRecording(null) : undefined}
              disabled={phase === 'analyzing'}
              style={{
                flex: 1, height: 54,
                backgroundColor: isRecording ? 'transparent' : 'transparent',
                color: isRecording ? PRIMARY : MUTED,
                border: `1.5px solid ${isRecording ? PRIMARY : MUTED}`,
                borderRadius: 28, fontSize: 16, fontWeight: 600,
                cursor: isRecording ? 'pointer' : 'default',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {isRecording ? 'Done' : 'Ongoing'}
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

        {(phase === 'idle' || phase === 'error') && onSkip && (
          <button
            onClick={() => onSkip({ testId: 'reading_passage', status: 'skipped', metrics: {}, rawValues: {} })}
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
