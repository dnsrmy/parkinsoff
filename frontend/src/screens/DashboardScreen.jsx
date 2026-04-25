import { useState, useEffect } from 'react';
import { getAnalyses, getUser } from '../utils/storage.js';
import DisclaimerBlock from '../components/DisclaimerBlock.jsx';
import { computeOverallResult } from '../utils/scoringEngine.js';

import { exportToPdf } from '../utils/exportPdf.js';
import {
  VoiceStabilityGraph, SyllableRateGraph, SpeechRateGraph,
  TappingIntervalGraph, SpiralDeviationGraph, ReactionTimeHistogram, TremorPowerGraph
} from '../components/dashboard/TestGraphs';

// ─── Design constants ─────────────────────────────────────────────────────────
const T = {
  bg: '#E8EAF6', surface: '#FFFFFF', border: '#E8E0FF',
  brand: '#7C6AF7', brandBg: '#EDE9FF', brandBorder: '#C4B5FD',
  accent: '#7C6AF7', accentBg: '#EDE9FF',
  text: '#1A1A2E', textSec: '#3D3D5C', muted: '#9E9EB0', faint: '#D8D6F0',
  green: '#065F46', greenBg: '#ECFDF5', greenBorder: '#A7F3D0',
  amber: '#92400E', amberBg: '#FFFBEB', amberBorder: '#FCD34D',
  red: '#991B1B', redBg: '#FFF1F2', redBorder: '#FECACA',
};

const TIER_STYLE = {
  no_indicators:          { bg: T.greenBg,  border: T.greenBorder, text: T.green  },
  some_indicators_monitor:  { bg: T.amberBg,  border: T.amberBorder, text: T.amber  },
  some_indicators_followup: { bg: '#FFF7ED',  border: '#FED7AA',     text: '#9A3412' },
  multiple_indicators:      { bg: T.redBg,    border: T.redBorder,   text: T.red    },
};

const STATUS_STYLE = {
  in_range:    { bg: T.greenBg, text: T.green,  label: 'In Range',    dot: '#059669' },
  borderline:  { bg: T.amberBg, text: T.amber,  label: 'Borderline',  dot: '#D97706' },
  out_of_range:{ bg: T.redBg,   text: T.red,    label: 'Out of Range',dot: '#DC2626' },
  skipped:     { bg: '#F8FAFC', text: '#64748B', label: 'Skipped',     dot: '#94A3B8' },
  unknown:     { bg: '#F1F5F9', text: T.muted,  label: 'Not Taken',   dot: '#94A3B8' },
};

const STRONG_TESTS = [
  { id: 'sustained_vowel', label: 'Sustained Vowel', icon: null },
  { id: 'rest_tremor',     label: 'Rest Tremor',     icon: null },
  { id: 'finger_tapping',  label: 'Finger Tapping',  icon: null },
];

const SUPPORTING_TESTS = [
  { id: 'pataka',          label: 'Pa-Ta-Ka Speech', icon: null },
  { id: 'reading_passage', label: 'Reading Passage',  icon: null },
  { id: 'spiral_drawing',  label: 'Spiral Drawing',   icon: null },
  { id: 'reaction_time',   label: 'Reaction Time',    icon: null },
];

const GRAPH_MAP = {
  sustained_vowel: VoiceStabilityGraph,
  pataka:          SyllableRateGraph,
  reading_passage: SpeechRateGraph,
  finger_tapping:  TappingIntervalGraph,
  spiral_drawing:  SpiralDeviationGraph,
  reaction_time:   ReactionTimeHistogram,
  rest_tremor:     TremorPowerGraph,
};

const GRAPH_LABELS = {
  sustained_vowel: 'Voice Stability',
  pataka:          'Pa-Ta-Ka Rhythm',
  reading_passage: 'Speech Rate & Pauses',
  finger_tapping:  'Tapping Intervals',
  spiral_drawing:  'Spiral Deviation',
  reaction_time:   'Reaction Time Distribution',
  rest_tremor:     'Tremor Power',
};

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      backgroundColor: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '24px 28px',
      boxShadow: '0 2px 12px rgba(15,23,42,0.07)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: T.muted, marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: s.bg, color: s.text,
      borderRadius: 100, padding: '4px 12px',
      fontSize: 13, fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

function TestMetricLine({ testId, tr }) {
  if (!tr || !tr.rawValues) return null;
  const rv = tr.rawValues;
  const lines = [];
  if (testId === 'sustained_vowel') {
    if (rv.phonationTime != null)  lines.push(`Duration: ${rv.phonationTime.toFixed(1)}s`);
    if (rv.amplitudeCV != null)    lines.push(`CV: ${rv.amplitudeCV.toFixed(2)}`);
    if (rv.energyVariance != null) lines.push(`Var: ${(rv.energyVariance * 1000).toFixed(2)}×10⁻³`);
    if (rv.silenceRatio != null)   lines.push(`Silence: ${(rv.silenceRatio * 100).toFixed(0)}%`);
  }
  if (testId === 'rest_tremor' && rv.power_ratio_3_7hz != null)
    lines.push(`Tremor: ${rv.power_ratio_3_7hz.toFixed(3)}`);
  if (testId === 'finger_tapping') {
    if (rv.mean_intertap_ms != null) lines.push(`ITI: ${rv.mean_intertap_ms.toFixed(0)}ms`);
    if (rv.interval_cv != null)      lines.push(`CV: ${rv.interval_cv.toFixed(2)}`);
    if (rv.lr_asymmetry != null)     lines.push(`Asym: ${rv.lr_asymmetry.toFixed(2)}`);
  }
  if (testId === 'pataka' && rv.syllable_rate != null)
    lines.push(`Rate: ${rv.syllable_rate.toFixed(1)} syl/s`);
  if (testId === 'reading_passage' && rv.speech_rate_wpm != null)
    lines.push(`Rate: ${rv.speech_rate_wpm.toFixed(0)} wpm`);
  if (testId === 'spiral_drawing') {
    if (rv.velocityCV != null)    lines.push(`Vel.CV: ${rv.velocityCV.toFixed(2)}`);
    if (rv.irregularity != null)  lines.push(`Tremor: ${(rv.irregularity * 100).toFixed(0)}%`);
  }
  if (testId === 'reaction_time' && rv.mean_rt_ms != null)
    lines.push(`Mean RT: ${rv.mean_rt_ms.toFixed(0)}ms`);
  if (!lines.length) return null;
  return (
    <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>{lines.join('  ·  ')}</div>
  );
}

// ─── Graph card with expand/collapse ─────────────────────────────────────────
function GraphCard({ testId, tr }) {
  const [open, setOpen] = useState(false);
  const GraphComp = GRAPH_MAP[testId];
  if (!GraphComp) return null;
  const label = GRAPH_LABELS[testId] || testId;
  const status = tr?.status || 'unknown';
  const ss = STATUS_STYLE[status];

  return (
    <Card style={{ marginBottom: 12, padding: '18px 24px' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{label}</span>
          <span style={{
            backgroundColor: ss.bg, color: ss.text,
            borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
          }}>
            {ss.label}
          </span>
        </div>
        <span style={{ color: T.muted, fontSize: 18, lineHeight: 1 }}>{open ? '^' : 'v'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 16 }}>
          {tr ? (
            <GraphComp
                rawValues={tr.rawValues ?? null}
                {...(testId === 'spiral_drawing' ? { spiralImageDataUrl: tr.spiralImageDataUrl ?? null } : {})}
              />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: T.muted, fontSize: 14 }}>
              Test not completed in this session
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main DashboardScreen ─────────────────────────────────────────────────────
export default function DashboardScreen({ onNavigate, onRetake, allTestResults: propTestResults }) {
  const user        = getUser();
  const allAnalyses = getAnalyses();
  const latest      = allAnalyses[0] || null;

  const [allTestResults,  setAllTestResults]  = useState(null);
  const [sessionAnswers,  setSessionAnswers]  = useState(null);
  const [profileAnswers,  setProfileAnswers]  = useState(null);
  const [overallResult,   setOverallResult]   = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try {
      const storedAtr = JSON.parse(localStorage.getItem('parkinsons_allTestResults') || 'null');
      const sa  = JSON.parse(localStorage.getItem('parkinsons_sessionAnswers')  || 'null');
      const pa  = JSON.parse(localStorage.getItem('parkinsons_profileAnswers')  || 'null');
      // Prefer in-session prop data over localStorage
      const atr = (propTestResults && Object.keys(propTestResults).length > 0)
        ? propTestResults
        : storedAtr;
      if (atr && Object.keys(atr).length > 0) {
        setAllTestResults(atr);
        setSessionAnswers(sa);
        setProfileAnswers(pa);
        setOverallResult(computeOverallResult(atr, pa, sa));
      }
    } catch (_) {}
  }, [propTestResults]);

  function handleDownloadReport() {
    exportToPdf({
      allTestResults,
      sessionAnswers,
      profileAnswers,
      allAnalyses,
    });
  }

  function handleSchedule() {
    const start = new Date();
    start.setDate(start.getDate() + 30);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    const fmt = d =>
      `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}` +
      `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', 'Follow-up Neurological Screening');
    url.searchParams.set('details', 'Parkinsoff screening follow-up recommended. Discuss your screening results with your doctor.');
    url.searchParams.set('dates', `${fmt(start)}/${fmt(end)}`);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  const hasNewFlow = allTestResults && Object.keys(allTestResults).length > 0;

  const tierStyle = overallResult
    ? (TIER_STYLE[overallResult.resultTier] || TIER_STYLE.no_indicators)
    : null;

  return (
    <div style={{
      backgroundColor: T.bg,
      minHeight: '100dvh',
      fontFamily: "'Inter', system-ui, sans-serif",
      paddingBottom: 80,
    }}>

      {/* ── Top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: T.surface,
        borderBottom: `1px solid ${T.border}`,
        height: 60, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 8px rgba(15,23,42,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, backgroundColor: T.brand,
            borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>PO</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
            Parkinsoff
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {latest && (
            <span style={{ fontSize: 13, color: T.muted }}>
              {fmtDate(latest.date)}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '24px 16px' : '32px 24px' }}>

        {/* ══ SECTION 1 — Overall Result ══ */}
        {overallResult && tierStyle ? (
          <div style={{
            background: tierStyle.bg,
            border: `2px solid ${tierStyle.border}`,
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 28,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tierStyle.text, opacity: 0.7, marginBottom: 8 }}>
              Parkinsoff Assessment Result
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: tierStyle.text, marginBottom: 10, lineHeight: 1.3 }}>
              {overallResult.resultLabel}
            </div>
            {overallResult.resultExplanation && (
              <p style={{ margin: '0 0 12px', fontSize: 15, color: tierStyle.text, lineHeight: 1.65, opacity: 0.9 }}>
                {overallResult.resultExplanation}
              </p>
            )}
            {overallResult.caveat && (
              <div style={{
                display: 'inline-flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(255,255,255,0.55)', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, color: tierStyle.text,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>Note:</span>
                <span><strong>Confidence note:</strong> {overallResult.caveat}</span>
              </div>
            )}
          </div>
        ) : (
          <Card style={{ marginBottom: 28, textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: 15, color: T.muted, marginBottom: 16 }}>
              No assessment data yet.
            </div>
            <button
              onClick={() => onRetake ? onRetake() : onNavigate('welcome')}
              style={{
                backgroundColor: T.brand, color: '#fff', border: 'none',
                borderRadius: 28, height: 50, padding: '0 28px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Start Assessment
            </button>
          </Card>
        )}

        {/* ══ SECTION 2 — Strong Tests ══ */}
        {hasNewFlow && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Core Indicators (Strongest Clinical Signals)</SectionLabel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 12,
            }}>
              {STRONG_TESTS.map(({ id, label, icon }) => {
                const tr     = allTestResults?.[id];
                const status = tr?.status ?? 'unknown';
                const ss     = STATUS_STYLE[status];
                return (
                  <Card key={id} style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</span>
                    </div>
                    <StatusBadge status={status} />
                    <TestMetricLine testId={id} tr={tr} />
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ SECTION 3 — Supporting Tests ══ */}
        {hasNewFlow && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Supporting Tests</SectionLabel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {SUPPORTING_TESTS.map(({ id, label, icon }) => {
                const tr     = allTestResults?.[id];
                const status = tr?.status ?? 'unknown';
                return (
                  <Card key={id} style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</span>
                    </div>
                    <StatusBadge status={status} />
                    <TestMetricLine testId={id} tr={tr} />
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ SECTION 4 — Graphs ══ */}
        {hasNewFlow && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Test Results & Graphs (tap to expand)</SectionLabel>
            {[...STRONG_TESTS, ...SUPPORTING_TESTS].map(({ id }) => (
              <GraphCard key={id} testId={id} tr={allTestResults?.[id] ?? null} />
            ))}
          </div>
        )}

        {/* ══ Recent history (compact) ══ */}
        {allAnalyses.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Recent History</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    {['Date', 'Signal Level', 'Score'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: T.muted,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        borderBottom: `1px solid ${T.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allAnalyses.slice(0, 5).map((a, i) => {
                    const sev = a.severityLevel || 'none';
                    const SEV_LABELS = { watch: 'Notable', medium: 'Moderate', low: 'Low', none: 'No signals' };
                    const SEV_COLOR  = { watch: T.red, medium: T.amber, low: T.green, none: T.muted };
                    return (
                      <tr key={a.id || i} style={{ borderBottom: i < 4 ? `1px solid ${T.border}` : 'none' }}>
                        <td style={{ padding: '12px 16px', color: T.textSec }}>{fmtDate(a.date)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: SEV_COLOR[sev] || T.muted }}>
                          {SEV_LABELS[sev] || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: T.textSec }}>{a.score ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{
                padding: '12px 16px', borderTop: `1px solid ${T.border}`,
                textAlign: 'right',
              }}>
                <button
                  onClick={() => onNavigate('history')}
                  style={{
                    background: 'none', border: 'none', color: T.accent,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  View all history
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* ══ SECTION 5 — Session Context ══ */}
        {sessionAnswers && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Session Context</SectionLabel>
            <Card>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '4px 24px',
              }}>
                {[
                  ['Sleep (last night)', sessionAnswers.sleep_hours != null ? `${sessionAnswers.sleep_hours} hours` : '—'],
                  ['Caffeine (last 2h)',  sessionAnswers.caffeine_recent  ? 'Yes' : 'No'],
                  ['Alcohol (last 12h)', sessionAnswers.alcohol_recent   ? 'Yes' : 'No'],
                  ['Environment',        sessionAnswers.environment_noisy ? 'Noisy' : 'Quiet'],
                  ['Age group',          sessionAnswers.age_65_or_older   ? '65 or older' : 'Under 65'],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '7px 0', borderBottom: `1px solid ${T.faint}`,
                  }}>
                    <span style={{ fontSize: 13, color: T.textSec }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{value}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                These conditions may influence measurement reliability but do not change the screening result.
              </p>
            </Card>
          </div>
        )}

        {/* ══ SECTION 6 — Actions ══ */}
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Actions</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {/* Schedule Consultation */}
            <button
              onClick={handleSchedule}
              style={{
                backgroundColor: T.brand, color: '#fff', border: 'none',
                borderRadius: 28, height: 54, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(123,104,238,0.28)',
              }}
            >
              Schedule Consultation
            </button>

            {/* Retake Assessment */}
            <button
              onClick={() => onRetake ? onRetake() : onNavigate('welcome')}
              style={{
                backgroundColor: T.accentBg, color: T.accent,
                border: `1.5px solid ${T.accent}`,
                borderRadius: 28, height: 54, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Retake Assessment
            </button>

            {/* Download Report */}
            <button
              onClick={handleDownloadReport}
              style={{
                backgroundColor: T.surface, color: T.textSec,
                border: `1.5px solid ${T.border}`,
                borderRadius: 28, height: 54, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Download Report
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <DisclaimerBlock screen="dashboard" />
      </div>
    </div>
  );
}
