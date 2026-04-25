import { useState, useEffect, useRef, useCallback } from 'react';
import { analyseSpiral } from '../../utils/analysisEngine.js';
import { labelMetric, labelTest } from '../../utils/scoringEngine.js';
import { THRESHOLDS } from '../../utils/thresholds.js';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';
const GREEN   = '#7DC95E';

const CANVAS_H = 380;
const MIN_PATH  = 200;
const TURNS     = 3;

const TABS       = ['CONTEXT QUESTIONS', 'VOICE', 'MOTOR', 'COGNITIVE', 'TREMORS'];
const ACTIVE_TAB = 'MOTOR';

function drawGuide(ctx, cw, ch) {
  const cx = cw / 2, cy = ch / 2;
  const maxR = Math.min(cw, ch) * 0.40;
  const steps = TURNS * 60;

  ctx.beginPath();
  ctx.strokeStyle = '#C4B5FD';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TURNS * 2 * Math.PI;
    const r = (t / (TURNS * 2 * Math.PI)) * maxR;
    const x = cx + r * Math.cos(t - Math.PI / 2);
    const y = cy + r * Math.sin(t - Math.PI / 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = PRIMARY;
  ctx.fill();

  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PRIMARY;
  ctx.textAlign = 'center';
  ctx.fillText('Start here', cx, cy - 14);

  const tEnd = TURNS * 2 * Math.PI;
  const xEnd = cx + maxR * Math.cos(tEnd - Math.PI / 2);
  const yEnd = cy + maxR * Math.sin(tEnd - Math.PI / 2);
  ctx.beginPath();
  ctx.arc(xEnd, yEnd, 6, 0, Math.PI * 2);
  ctx.strokeStyle = PRIMARY;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#9E9EB0';
  ctx.fillText('End', xEnd, yEnd - 12);
}

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function scoreSpiral(pts) {
  if (pts.length < 6) return 0;
  const W = 3;
  let changes = 0;
  for (let i = W; i < pts.length - W; i++) {
    const dx1 = pts[i].x - pts[i - W].x, dy1 = pts[i].y - pts[i - W].y;
    const dx2 = pts[i + W].x - pts[i].x, dy2 = pts[i + W].y - pts[i].y;
    const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1), l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (l1 < 2 || l2 < 2) continue;
    const cross = Math.abs((dx1 / l1) * (dy2 / l2) - (dy1 / l1) * (dx2 / l2));
    if (cross > 0.45) changes++;
  }
  return Math.min(1, changes / (pts.length * 0.10));
}

function computeVelocityCV(pts) {
  const speeds = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x;
    const dy = pts[i].y - pts[i-1].y;
    const dt = (pts[i].timestamp || 0) - (pts[i-1].timestamp || 0);
    if (dt > 0 && dt < 300) speeds.push(Math.sqrt(dx*dx + dy*dy) / dt);
  }
  if (speeds.length < 3) return null;
  const mean = speeds.reduce((a,b) => a+b, 0) / speeds.length;
  const variance = speeds.reduce((s,v) => s+(v-mean)**2, 0) / speeds.length;
  return mean > 0 ? Math.sqrt(variance) / mean : null;
}

function computeProgress(pts, cx, cy, maxR) {
  if (!pts.length) return { completionPct: 0, maxRadiusReached: 0, angularSectors: new Set() };
  let maxRadiusReached = 0;
  const angularSectors = new Set();
  for (const pt of pts) {
    const dx = pt.x - cx, dy = pt.y - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > maxRadiusReached) maxRadiusReached = r;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;
    angularSectors.add(Math.floor(angle / (2 * Math.PI / 8)) % 8);
  }
  const len = pathLength(pts);
  const radialProgress  = Math.min(1, maxRadiusReached / maxR);
  const angularProgress = Math.min(1, angularSectors.size / 8);
  const lengthProgress  = Math.min(1, len / MIN_PATH);
  const completionPct = Math.round(
    (radialProgress * 0.4 + angularProgress * 0.4 + lengthProgress * 0.2) * 100
  );
  return { completionPct, maxRadiusReached, angularSectors };
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

export default function SpiralStep({ onComplete, onSkip, onBack }) {
  const [phase, setPhase]                 = useState('drawing');
  const [completionPct, setCompletionPct] = useState(0);
  const [stats, setStats]                 = useState(null);
  const [validationMsg, setValidationMsg] = useState(null);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const drawing      = useRef(false);
  const pts          = useRef([]);
  const canvasSize   = useRef({ w: 0, h: CANVAS_H });
  const maxRRef      = useRef(0);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvasSize.current.w;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cw, CANVAS_H);
    maxRRef.current = Math.min(cw, CANVAS_H) * 0.40;
    drawGuide(ctx, cw, CANVAS_H);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      const canvas = canvasRef.current;
      if (!canvas || w === 0) return;
      canvas.width  = w;
      canvas.height = CANVAS_H;
      canvasSize.current = { w, h: CANVAS_H };
      clearCanvas();
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [clearCanvas]);

  useEffect(() => { clearCanvas(); }, [clearCanvas]);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { w } = canvasSize.current;
    const scaleX = w / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function redrawPath() {
    clearCanvas();
    const p = pts.current;
    if (p.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (const pt of p.slice(1)) ctx.lineTo(pt.x, pt.y);
    ctx.strokeStyle = '#2D3A8C';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function onDown(e) {
    e.preventDefault();
    drawing.current = true;
    pts.current = [{ ...getPos(e), timestamp: Date.now() }];
    setCompletionPct(0);
    setValidationMsg(null);
    redrawPath();
  }

  function onMove(e) {
    e.preventDefault();
    if (!drawing.current) return;
    pts.current.push({ ...getPos(e), timestamp: Date.now() });
    const cw = canvasSize.current.w;
    const cx = cw / 2, cy = CANVAS_H / 2;
    const { completionPct: pct } = computeProgress(pts.current, cx, cy, maxRRef.current);
    setCompletionPct(pct);
    redrawPath();
  }

  function onUp(e) {
    e.preventDefault();
    drawing.current = false;
  }

  function handleDone() {
    const cw = canvasSize.current.w;
    const cx = cw / 2, cy = CANVAS_H / 2;
    const { completionPct: pct, maxRadiusReached, angularSectors } = computeProgress(
      pts.current, cx, cy, maxRRef.current
    );

    if (maxRadiusReached < maxRRef.current * 0.5) { setValidationMsg('center'); return; }
    if (angularSectors.size < 4)                   { setValidationMsg('partial'); return; }
    if (pct < 40)                                  { setValidationMsg('short');   return; }

    const irregularity = scoreSpiral(pts.current);
    const spiralImageDataUrl = canvasRef.current.toDataURL('image/png');
    const spiralResult = analyseSpiral(pts.current, cw, CANVAS_H);

    if (!spiralResult.valid) { setValidationMsg('analysis_error'); return; }

    const velocityCV = computeVelocityCV(pts.current);
    const metrics = {
      velocity_cv: labelMetric(velocityCV, THRESHOLDS.spiral_drawing.velocity_cv),
      power_fraction_4_7hz: 'unknown',
    };
    const status = labelTest(metrics);
    const s = {
      testId: 'spiral_drawing',
      status,
      metrics,
      rawValues: { velocityCV, irregularity, completionPct: pct, penLifts: 0 },
      spiralImageDataUrl,
      spiralResult,
      timestamp: Date.now(),
    };
    setStats(s);
    setValidationMsg('ok');
    setTimeout(() => { setPhase('done'); }, 800);
  }

  function handleClear() {
    pts.current = [];
    setCompletionPct(0);
    setValidationMsg(null);
    clearCanvas();
  }

  const isDone = phase === 'done';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif' }}>
      <TabBar />
      <div style={{ padding: '24px 24px 40px', maxWidth: 480, margin: '0 auto' }}>

        {/* Return button */}
        {onBack && (phase === 'done' || phase === 'drawing') && (
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
            Spiral Drawing
          </div>
          <div style={{ fontSize: 15, color: '#3D3D5C', lineHeight: 1.5 }}>
            Trace the spiral from the center outward without lifting your finger.
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

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: MUTED }}>Progress</span>
            <span style={{ fontSize: 12, color: MUTED }}>{completionPct}%</span>
          </div>
          <div style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', backgroundColor: completionPct >= 100 ? GREEN : PRIMARY,
              borderRadius: 2, width: `${completionPct}%`, transition: 'width 200ms ease',
            }} />
          </div>
        </div>

        {/* Canvas card */}
        <div ref={containerRef} style={{
          width: '100%', backgroundColor: CARD, borderRadius: 16,
          overflow: 'hidden', marginBottom: 12,
          boxShadow: '0 2px 12px rgba(26,26,46,0.08)',
          border: '1.5px solid #E8E0FF',
        }}>
          <canvas
            ref={canvasRef}
            style={{
              display: 'block', width: '100%', height: `${CANVAS_H}px`,
              cursor: phase === 'drawing' ? 'crosshair' : 'default',
              touchAction: 'none', backgroundColor: '#FFFFFF',
            }}
            onMouseDown={phase === 'drawing' ? onDown : undefined}
            onMouseMove={phase === 'drawing' ? onMove : undefined}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={phase === 'drawing' ? onDown : undefined}
            onTouchMove={phase === 'drawing' ? onMove : undefined}
            onTouchEnd={onUp}
          />
        </div>

        {/* Validation messages */}
        {validationMsg === 'center' && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
                        padding: '14px 18px', fontSize: 14, color: '#92400E', lineHeight: 1.5, marginBottom: 12 }}>
            The drawing stayed close to the centre. Please trace the spiral further outward.
          </div>
        )}
        {validationMsg === 'partial' && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
                        padding: '14px 18px', fontSize: 14, color: '#92400E', lineHeight: 1.5, marginBottom: 12 }}>
            Only part of the spiral was covered. Please trace around more of the path.
          </div>
        )}
        {validationMsg === 'short' && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
                        padding: '14px 18px', fontSize: 14, color: '#92400E', lineHeight: 1.5, marginBottom: 12 }}>
            It looks like the drawing may be incomplete. Please trace a little more — it does not need to be perfect.
          </div>
        )}
        {validationMsg === 'analysis_error' && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
                        padding: '14px 18px', fontSize: 14, color: '#92400E', lineHeight: 1.5, marginBottom: 12 }}>
            Please draw more of the spiral before finishing.
          </div>
        )}
        {validationMsg === 'ok' && (
          <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10,
                        padding: '14px 18px', fontSize: 14, color: '#065F46', lineHeight: 1.5, marginBottom: 12 }}>
            Drawing recorded. Well done.
          </div>
        )}

        {/* Bottom buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <RedoButton active={phase === 'drawing'} onClick={handleClear} />

          {phase === 'drawing' && (
            <button
              onClick={handleDone}
              style={{
                flex: 1, height: 54, backgroundColor: PRIMARY, color: '#fff',
                border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              }}
            >
              Done
            </button>
          )}

          {isDone && stats && (
            <button
              onClick={() => onComplete(stats)}
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

        {phase === 'drawing' && onSkip && (
          <button
            onClick={() => onSkip({ completed: false, irregularity: 0, spiralResult: null })}
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
