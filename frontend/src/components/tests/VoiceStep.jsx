import { useState, useEffect, useRef } from 'react';
import { processVoiceBlob } from '../../utils/voiceProcessor.js';
import { WaveformDisplay } from '../WaveformDisplay';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';
const GREEN   = '#7DC95E';

const MAX_DURATION    = 20;
const TARGET_DURATION = 8;
const THRESHOLD       = 0.018;

const STATUS_COLORS = {
  within_range:    { text: '#065F46', bg: '#ECFDF5' },
  worth_monitoring:{ text: '#92400E', bg: '#FFFBEB' },
  outside_range:   { text: '#991B1B', bg: '#FFF1F2' },
};

const TABS       = ['CONTEXT QUESTIONS', 'VOICE', 'MOTOR', 'COGNITIVE', 'TREMORS'];
const ACTIVE_TAB = 'VOICE';

function qualityBadge(vsq) {
  if (vsq == null) return null;
  if (vsq < 0.25)  return { text: 'Stable', color: '#065F46', bg: '#ECFDF5' };
  if (vsq < 0.50)  return { text: 'Slight variability', color: '#92400E', bg: '#FFFBEB' };
  return                  { text: 'Notable irregularity', color: '#991B1B', bg: '#FFF1F2' };
}

function getVoiceLabel(score) {
  if (score == null) return { label: 'Analysis complete', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', text: 'Voice recording completed.' };
  if (score <= 0.33) return { label: 'Within expected range', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', text: 'Your phonation duration, stability, and energy patterns are within typical ranges.' };
  if (score <= 0.66) return { label: 'Mild irregularities detected', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', text: 'Some variation in vocal stability was detected. This may be normal or worth tracking over time.' };
  return               { label: 'Pattern worth monitoring', color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3', text: 'Multiple voice patterns suggest irregularities worth discussing with a healthcare professional.' };
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

export default function VoiceStep({ onComplete, onSkip, onBack }) {
  const [phase, setPhase]           = useState('idle');
  const [elapsed, setElapsed]       = useState(0);
  const [peakAmp, setPeakAmp]       = useState(0);
  const [stats, setStats]           = useState(null);
  const [resultSource, setResultSource] = useState(null);
  const [permError, setPermError]   = useState('');
  const [durationWarning, setDurationWarning] = useState(false);
  const [durationWarningType, setDurationWarningType] = useState('short');
  const [quietWarning, setQuietWarning] = useState(false);
  const [curAmp, setCurAmp]         = useState(0);

  const [mediaStream, setMediaStream] = useState(null);

  const contextRef   = useRef(null);
  const analyserRef  = useRef(null);
  const streamRef    = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const amplitudeHistRef = useRef([]);
  const rafRef       = useRef(null);
  const intervalRef  = useRef(null);
  const startRef     = useRef(null);
  const elapsedRef   = useRef(0);
  const curAmpRef    = useRef(0);

  useEffect(() => () => stopAll(), []);

  function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (contextRef.current?.state !== 'closed') contextRef.current?.close().catch(() => {});
    setMediaStream(null);
  }

  async function startRecording() {
    setStats(null);
    setResultSource(null);
    setPermError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMediaStream(stream);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      contextRef.current = ctx;
      console.log(`[VoiceStep] AudioContext initial state: ${ctx.state}`);
      if (ctx.state === 'suspended') await ctx.resume();
      console.log(`[VoiceStep] AudioContext running state: ${ctx.state}`);
      console.log(`[VoiceStep] Stream tracks: ${stream.getAudioTracks().map(t => `${t.label}(${t.readyState})`).join(', ')}`);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      amplitudeHistRef.current = [];
      startRef.current = Date.now();
      elapsedRef.current = 0;
      setPhase('recording');
      recorder.start(100);
      intervalRef.current = setInterval(() => {
        const t = (Date.now() - startRef.current) / 1000;
        elapsedRef.current = t;
        setElapsed(t);
        if (t >= MAX_DURATION) finish();
      }, 80);
      const buf = new Uint8Array(analyser.fftSize);
      function tick() {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        amplitudeHistRef.current.push(rms);
        curAmpRef.current = rms;
        setCurAmp(rms);
        setPeakAmp(p => Math.max(p, rms));
        const recentSlice = amplitudeHistRef.current.slice(-15);
        const recentMax = recentSlice.length ? Math.max(...recentSlice) : 0;
        const tNow = (Date.now() - startRef.current) / 1000;
        if (tNow > 1.5 && recentMax < THRESHOLD) setQuietWarning(true);
        else if (recentMax >= THRESHOLD) setQuietWarning(false);
        if (amplitudeHistRef.current.length % 60 === 1) {
          console.log(`[VoiceStep] rms=${rms.toFixed(4)} recentMax=${recentMax.toFixed(4)} frames=${amplitudeHistRef.current.length}`);
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setPermError('Microphone access denied. Allow access in browser settings or skip this step.');
    }
  }

  function finish() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log(`[VoiceStep] New recording blob: size=${blob.size} bytes, type=${blob.type}, ts=${Date.now()}`);
        stopAll();
        await runAnalysis(blob);
      };
      recorder.stop();
    } else {
      stopAll();
      runAnalysis(null);
    }
  }

  function localAnalysis() {
    const hist = amplitudeHistRef.current;
    const totalDuration = elapsedRef.current;
    const active = hist.filter(v => v > THRESHOLD);
    const phonationTime = (active.length / Math.max(hist.length, 1)) * totalDuration;
    const silenceRatio = 1 - (active.length / Math.max(hist.length, 1));
    const mean = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0;
    const variance = active.length ? active.reduce((a, b) => a + (b - mean) ** 2, 0) / active.length : 0;
    const amplitudeCV = mean > 0 ? Math.sqrt(variance) / mean : 0;
    let energyVariance = 0;
    let energyEntropy = 0;
    if (hist.length >= 10) {
      const WINDOWS = 10;
      const wSize = Math.floor(hist.length / WINDOWS);
      const windowRMS = Array.from({ length: WINDOWS }, (_, w) => {
        const win = hist.slice(w * wSize, (w + 1) * wSize);
        return Math.sqrt(win.reduce((s, v) => s + v * v, 0) / win.length);
      });
      const meanWRMS = windowRMS.reduce((a, b) => a + b, 0) / WINDOWS;
      energyVariance = windowRMS.reduce((s, v) => s + (v - meanWRMS) ** 2, 0) / WINDOWS;
      const totalE = windowRMS.reduce((s, v) => s + v, 0);
      if (totalE > 0) {
        const probs = windowRMS.map(v => v / totalE);
        const rawH = -probs.reduce((s, p) => p > 0 ? s + p * Math.log2(p) : s, 0);
        energyEntropy = rawH / Math.log2(WINDOWS);
      }
    }
    // RMS energy from PCM amplitude frames (avoids byte-level compressed-audio artifacts)
    const rmsEnergy = hist.length > 0
      ? Math.sqrt(hist.reduce((s, v) => s + v * v, 0) / hist.length)
      : 0;
    // Jitter proxy: CV of inter-peak intervals in amplitude envelope (approximates pitch period variability)
    let jitterProxy = 0;
    if (hist.length >= 30) {
      const peakIntervals = [];
      let lastPeakIdx = -1;
      for (let i = 1; i < hist.length - 1; i++) {
        if (hist[i] > hist[i - 1] && hist[i] > hist[i + 1] && hist[i] > THRESHOLD) {
          if (lastPeakIdx >= 0) peakIntervals.push(i - lastPeakIdx);
          lastPeakIdx = i;
        }
      }
      if (peakIntervals.length >= 4) {
        const meanInterval = peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length;
        const varInterval = peakIntervals.reduce((s, v) => s + (v - meanInterval) ** 2, 0) / peakIntervals.length;
        jitterProxy = meanInterval > 0 ? Math.sqrt(varInterval) / meanInterval : 0;
      }
    }
    console.log(`[VoiceStep] localAnalysis — rmsEnergy=${rmsEnergy.toFixed(4)} jitterProxy=${jitterProxy.toFixed(4)} amplitudeCV=${amplitudeCV.toFixed(4)} energyVariance=${energyVariance.toFixed(6)} energyEntropy=${energyEntropy.toFixed(4)}`);
    return { phonationTime, amplitudeCV, voiceTremor: amplitudeCV > 0.35, energyVariance, silenceRatio, totalDuration, rmsEnergy, jitterProxy, energyEntropy };
  }

  async function runAnalysis(blob) {
    const local = localAnalysis();
    const pcmStats = {
      phonationTime: local.phonationTime,
      amplitudeCV: local.amplitudeCV,
      energyVariance: local.energyVariance,
      silenceRatio: local.silenceRatio,
      totalDuration: local.totalDuration,
    };

    // Show local results immediately — never block on API
    setStats({ ...local, voiceResult: null });
    setResultSource('local');
    setPhase('done');
    onComplete({
      completed: true,
      phonationTime: local.phonationTime,
      amplitudeCV: local.amplitudeCV,
      silenceRatio: local.silenceRatio,
      energyVariance: local.energyVariance,
      energyEntropy: local.energyEntropy,
      rmsEnergy: local.rmsEnergy,
      jitterProxy: local.jitterProxy,
      voiceTremor: local.voiceTremor,
      voiceResult: null,
    });

    // Enhance with AI in background (non-blocking)
    if (blob && blob.size > 1000) {
      try {
        const voiceResult = await processVoiceBlob(blob, pcmStats);
        setStats(prev => ({ ...prev, voiceResult }));
        setResultSource('ai');
      } catch { /* keep local results */ }
    }
  }

  function handleStopEarly() {
    if (elapsedRef.current < 3) { setDurationWarningType('short'); setDurationWarning(true); return; }
    const voiced = amplitudeHistRef.current.filter(v => v > THRESHOLD).length;
    const voicedSec = (voiced / Math.max(amplitudeHistRef.current.length, 1)) * elapsedRef.current;
    if (voicedSec < 2) { setDurationWarningType('quiet'); setDurationWarning(true); return; }
    setDurationWarning(false);
    finish();
  }

  function handleTryAgain() {
    setPhase('idle');
    setStats(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setPeakAmp(0);
    setCurAmp(0);
    setResultSource(null);
    setDurationWarning(false);
    setQuietWarning(false);
  }

  const elapsedSec = Math.floor(elapsed);
  const targetSec  = 10;
  const progressPct = Math.min(100, (elapsed / targetSec) * 100);
  const isRecording  = phase === 'recording';
  const isDone       = phase === 'done' && stats;

  const finalDuration = stats?.voiceResult?.duration ?? stats?.phonationTime ?? 0;
  const _vsq          = stats?.voiceResult?.voiceScore ?? null;
  const badge         = qualityBadge(_vsq);

  // Timer label for badge
  function timerBadgeText() {
    if (phase === 'idle')      return `0s / ${targetSec}s`;
    if (isRecording)           return `${elapsedSec}s / ${targetSec}s`;
    if (phase === 'analyzing') return `${elapsedSec}s / ${targetSec}s`;
    if (isDone)                return `${Math.round(finalDuration)}s / ${targetSec}s`;
    return `0s / ${targetSec}s`;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
      <TabBar />

      <div style={{ padding: '24px 24px 40px', maxWidth: 480, margin: '0 auto' }}>

        {/* Return button */}
        {onBack && (phase === 'idle' || isDone) && (
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
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
            Sustained Tone Analysis
          </div>
          <div style={{ fontSize: 15, color: '#3D3D5C', lineHeight: 1.5 }}>
            Press Start, take a deep breath and say "ahhh" at a steady pitch for {targetSec} seconds
          </div>
        </div>

        {/* Test Complete banner */}
        {isDone && (
          <div style={{
            backgroundColor: GREEN, borderRadius: 10, padding: '12px 0',
            textAlign: 'center', fontSize: 17, fontWeight: 600, color: '#fff',
            marginBottom: 16,
          }}>
            Test Complete
          </div>
        )}

        {/* Waveform card */}
        <div style={{
          backgroundColor: CARD, borderRadius: 16, overflow: 'hidden',
          marginBottom: 12, minHeight: 160,
          boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRecording ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E53935' }} />
                <span style={{ fontSize: 14, color: '#E53935', fontWeight: 600 }}>Recording</span>
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
            {timerBadgeText()}
          </div>
        </div>

        {/* Progress bar when recording */}
        {isRecording && (
          <div style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              backgroundColor: GREEN, borderRadius: 2, transition: 'width 0.08s linear',
            }} />
          </div>
        )}

        {/* Quiet warning */}
        {isRecording && quietWarning && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8,
                        padding: '10px 14px', fontSize: 13, color: '#92400E', marginBottom: 8, lineHeight: 1.5 }}>
            No voice detected — speak louder and hold the "ahhh" sound.
          </div>
        )}
        {isRecording && durationWarning && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8,
                        padding: '10px 14px', fontSize: 13, color: '#92400E', marginBottom: 8, lineHeight: 1.5 }}>
            {durationWarningType === 'short'
              ? 'Please hold the sound for at least 3 seconds before stopping.'
              : 'Voice was too quiet. Speak louder and hold for at least 2 seconds.'}
          </div>
        )}

        {/* Analyzing */}
        {phase === 'analyzing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: MUTED, fontSize: 14 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${PRIMARY}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
            Analysing recording...
          </div>
        )}

        {/* Result when done */}
        {isDone && (() => {
          const voiceScore = stats.voiceResult?.voiceScore ?? null;
          const cfg = getVoiceLabel(voiceScore);
          return (
            <div style={{ marginTop: 8 }}>
              {/* Voice result card */}
              <div style={{
                backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}`,
                borderRadius: 14, padding: 18, marginBottom: 12,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: cfg.color, marginBottom: 6 }}>{cfg.label}</div>
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{cfg.text}</p>
                {voiceScore != null && (
                  <div style={{ marginTop: 10, fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                    Weighted concern index: {Math.round(voiceScore * 100)}%
                  </div>
                )}
              </div>

              {/* 5 required voice variables */}
              <div style={{ backgroundColor: CARD, border: '1px solid #D4D0F0', borderRadius: 12,
                            padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.08em',
                              textTransform: 'uppercase', marginBottom: 10 }}>
                  VOICE FEATURES
                </div>
                {[
                  { label: 'Phonation duration', value: `${finalDuration.toFixed(1)}s`, ref: '≥ 8s typical' },
                  { label: 'Amplitude CV', value: stats.amplitudeCV?.toFixed(3), ref: '< 0.30 typical' },
                  { label: 'Energy variance', value: ((stats.energyVariance ?? 0) * 1000).toFixed(2) + ' ×10⁻³', ref: null },
                  { label: 'Silence ratio', value: `${((stats.silenceRatio ?? 0) * 100).toFixed(0)}%`, ref: '< 20% typical' },
                  { label: 'Energy entropy', value: (stats.energyEntropy ?? 0).toFixed(3), ref: '0.7–1.0 typical' },
                ].map(({ label, value, ref }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                                            padding: '5px 0', borderBottom: '1px solid #F0EFF8', fontSize: 13 }}>
                    <span style={{ color: '#3D3D5C' }}>{label}</span>
                    <span style={{ fontWeight: 700, color: TEXT }}>
                      {value ?? '—'}{ref && <span style={{ fontWeight: 400, color: MUTED, fontSize: 11 }}> ({ref})</span>}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          );
        })()}

        {permError && (
          <div style={{ backgroundColor: '#FFF1F2', border: '1px solid #FECACA',
                        borderRadius: 8, padding: '10px 14px', color: '#991B1B',
                        fontSize: 14, marginBottom: 12 }}>
            {permError}
          </div>
        )}

        {/* Bottom button row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <RedoButton
            active={isRecording || isDone}
            onClick={isRecording ? handleStopEarly : handleTryAgain}
          />

          {phase === 'idle' && (
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

          {isRecording && (
            <button
              onClick={handleStopEarly}
              style={{
                flex: 1, height: 54, backgroundColor: 'transparent', color: PRIMARY,
                border: `1.5px solid ${PRIMARY}`, borderRadius: 28, fontSize: 16, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Stop
            </button>
          )}

          {phase === 'analyzing' && (
            <button disabled style={{
              flex: 1, height: 54, backgroundColor: 'transparent', color: MUTED,
              border: `1.5px solid ${MUTED}`, borderRadius: 28, fontSize: 16, fontWeight: 600,
              cursor: 'default', fontFamily: 'system-ui, sans-serif',
            }}>
              Ongoing
            </button>
          )}

        </div>

        {/* Skip */}
        {(phase === 'idle' || isDone) && onSkip && (
          <button
            onClick={() => onSkip({ completed: false, phonationTime: 0, amplitudeCV: 0, voiceResult: null })}
            style={{
              background: 'none', border: 'none', color: MUTED, fontSize: 14,
              cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              textAlign: 'center', padding: '12px 0', width: '100%', marginTop: 4,
            }}
          >
            Skip voice test
          </button>
        )}

      </div>
    </div>
  );
}
