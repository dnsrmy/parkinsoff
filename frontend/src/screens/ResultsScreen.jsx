import { useState, useEffect } from 'react';
import { T, F, animStyle, btnPrimary, btnGhost } from '../design.js';
import DisclaimerBlock from '../components/DisclaimerBlock.jsx';
import {
  VoiceStabilityGraph, SyllableRateGraph, SpeechRateGraph,
  TappingIntervalGraph, SpiralDeviationGraph, ReactionTimeHistogram, TremorPowerGraph
} from '../components/dashboard/TestGraphs';
import { compareToBaseline } from '../utils/comparison.js';
import { ScoreScaleBar } from '../utils/scoreScale.jsx';

import { fuseScores, formatScoreForDisplay } from '../utils/analysisEngine.js';
import { computeOverallResult } from '../utils/scoringEngine.js';
import { exportToPdf } from '../utils/exportPdf.js';

const SEV_CONFIG = {
  watch: {
    color: T.red, bg: T.redBg, border: T.redBorder,
    label: 'Notable signal level',
    plainText: 'Our assessment detected several signals worth discussing with a neurologist. This does not mean you have Parkinson\'s disease, but a professional evaluation is recommended.',
    nextSteps: [
      { text: 'Schedule a neurologist appointment', action: 'schedule' },
      { text: 'Share this report with your doctor', action: 'export' },
      { text: 'Consider joining a Rock Steady Boxing or aerobic exercise programme', action: 'exercise' },
    ],
  },
  medium: {
    color: T.amber, bg: T.amberBg, border: T.amberBorder,
    label: 'Moderate signal level',
    plainText: 'Some signals were detected that are worth monitoring. Starting preventive habits now can make a real difference. There is no cause for alarm at this stage.',
    nextSteps: [
      { text: 'Begin 30 minutes of aerobic exercise each day', action: 'exercise' },
      { text: 'Repeat this assessment in 4–6 weeks', action: 'retake' },
      { text: 'Track new symptoms in your assessment history', action: 'history' },
    ],
  },
  low: {
    color: T.green, bg: T.greenBg, border: T.greenBorder,
    label: 'Low signal level',
    plainText: 'Only minimal signals were detected. Your results appear largely within normal ranges. Continue monitoring regularly as a healthy habit.',
    nextSteps: [
      { text: 'Monitor with regular assessments every 3–6 months', action: 'retake' },
      { text: 'Maintain your current exercise and sleep routine', action: 'exercise' },
      { text: 'Consult your GP if you notice any changes', action: 'schedule' },
    ],
  },
  none: {
    color: T.green, bg: T.greenBg, border: T.greenBorder,
    label: 'No signals detected',
    plainText: 'No significant signals were detected in this assessment. Your results are within normal ranges. Regular monitoring is still a good habit to maintain.',
    nextSteps: [
      { text: 'Retake this assessment in 6–12 months', action: 'retake' },
      { text: 'Maintain an active, healthy lifestyle', action: 'exercise' },
      { text: 'View your full assessment history', action: 'history' },
    ],
  },
};

const TEST_META = {
  voice: {
    label: 'Voice Analysis',
    desc: 'Phonation duration and vocal stability',
    getValue: (t) => t.phonationTime != null ? `${t.phonationTime.toFixed(1)}s phonation` : null,
  },
  face: {
    label: 'Facial Expression',
    desc: 'Checks for reduced facial movement (hypomimia)',
    getValue: (t) => t.difficulty ? `${t.difficulty} difficulty` : null,
  },
  tap: {
    label: 'Finger Tapping',
    desc: 'Tapping speed and rhythm regularity',
    getValue: (t) => t.ratePerSecond != null ? `${t.ratePerSecond.toFixed(1)} taps/s` : null,
  },
  spiral: {
    label: 'Spiral Drawing',
    desc: 'Detects tremor patterns in hand movement',
    getValue: (t) => t.irregularity != null ? `${(t.irregularity * 100).toFixed(0)}% irregularity` : null,
  },
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
}

function TestRow({ meta, t, last }) {
  if (!t) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${T.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          backgroundColor: T.bg, border: `1.5px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 4l6 6M10 4l-6 6" stroke={T.faint} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: F.label, fontWeight: 600, color: T.muted }}>{meta.label}</div>
          <div style={{ fontSize: F.caption, color: T.faint, marginTop: 2 }}>Not completed</div>
        </div>
      </div>
    );
  }

  const isFlag = t.status === 'flagged';
  const statusColor = isFlag ? T.amber : T.green;
  const detail = meta.getValue(t);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${T.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        backgroundColor: statusColor + '18', border: `1.5px solid ${statusColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isFlag ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 4v3M7 9.5v.5" stroke={statusColor} strokeWidth="2" strokeLinecap="round"/>
            <path d="M6 2L1 11.5h12L7 2z" stroke={statusColor} strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7l3.5 3.5 5.5-6" stroke={statusColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: F.label, fontWeight: 600, color: T.text }}>{meta.label}</div>
        <div style={{ fontSize: F.caption, color: T.muted, marginTop: 2 }}>{meta.desc}</div>
      </div>
      {detail && (
        <div style={{
          fontSize: F.small, color: statusColor, fontWeight: 600,
          backgroundColor: statusColor + '18', padding: '4px 10px',
          borderRadius: 8, flexShrink: 0,
        }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function BaselineBar({ item }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(item.percent), 100);
    return () => clearTimeout(t);
  }, [item.percent]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{item.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: item.color, fontWeight: 700 }}>{item.yourValue}</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color: item.color,
            backgroundColor: item.color + '18', padding: '6px 16px', borderRadius: 100,
            border: `1px solid ${item.color}33`,
          }}>
            {item.statusLabel}
          </span>
        </div>
      </div>
      <div style={{ height: 8, backgroundColor: T.bg, borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        <div style={{
          height: '100%', backgroundColor: item.color,
          borderRadius: 10, width: `${width}%`,
          transition: 'width 0.8s ease',
          opacity: 0.85,
        }} />
      </div>
      <div style={{ fontSize: 12, color: T.faint, marginTop: 5, lineHeight: 1.5 }}>
        Reference: {item.referenceRange}
      </div>
      {item.interpretation && (
        <div style={{ fontSize: 12, color: item.color, marginTop: 3, lineHeight: 1.5 }}>
          {item.interpretation}
        </div>
      )}
    </div>
  );
}

const ACTION_ICONS = {
  schedule: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="5" y1="1" x2="5" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11" y1="1" x2="11" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  export: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 10V2M8 2L5.5 4.5M8 2l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12v1.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  retake: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 106-6H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 4L6 6 4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  exercise: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5v5M6 8l-2 3M10 8l2 3M6 7l4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const EXERCISE_TIP = "Research supports 30+ minutes of aerobic exercise (walking, cycling, swimming) at least 5 days a week for neurological health. Rock Steady Boxing is a Parkinson's-specific programme available in many cities.";

const STATUS_COLORS = {
  in_range:    { bg: '#ECFDF5', color: '#065F46', label: 'In range' },
  borderline:  { bg: '#FFFBEB', color: '#92400E', label: 'Borderline' },
  out_of_range:{ bg: '#FFF1F2', color: '#991B1B', label: 'Outside range' },
  skipped:     { bg: '#F1F5F9', color: '#64748B', label: 'Skipped' },
  unknown:     { bg: '#F8FAFC', color: '#94A3B8', label: 'No data' },
};

const STRONG_TEST_LABELS = {
  sustained_vowel: 'Sustained Vowel (Voice)',
  rest_tremor:     'Rest Tremor',
  finger_tapping:  'Finger Tapping',
};

const SUPPORTING_TEST_LABELS = {
  pataka:          'Pa-Ta-Ka',
  reading_passage: 'Reading Passage',
  spiral_drawing:  'Spiral Drawing',
  reaction_time:   'Reaction Time',
};

function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, borderRadius: 100,
      padding: '4px 12px', fontSize: 12, fontWeight: 700,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.label}
    </span>
  );
}

export default function ResultsScreen({
  result, allTestResults, sessionAnswers, profileAnswers,
  onContinue, onExport, onBackToDashboard, onRetake, onViewHistory,
}) {
  const [phase, setPhase] = useState(0);
  const [actionTaken, setActionTaken] = useState(new Set());
  const [showExerciseTip, setShowExerciseTip] = useState(false);
  const [showSupporting, setShowSupporting] = useState(false);
  const [expandedMetrics, setExpandedMetrics] = useState({});
  const [showGraphs, setShowGraphs] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({});

  const hasNewFlow = allTestResults && Object.keys(allTestResults).length > 0;

  console.log('[Results] allTestResults keys:', Object.keys(allTestResults || {}));
  console.log('[Results] sustained_vowel:', allTestResults?.sustained_vowel?.status);
  console.log('[Results] spiral_drawing:', allTestResults?.spiral_drawing?.status);

  function openGoogleCalendar() {
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

  // New clinical rule-based result (only when new flow was used)
  const overallResult = hasNewFlow
    ? computeOverallResult(allTestResults, profileAnswers, sessionAnswers)
    : null;

  if (overallResult) {
    console.log('[Results] computeOverallResult:', {
      resultTier: overallResult.resultTier,
      resultLabel: overallResult.resultLabel,
      flaggedStrongTests: overallResult.flaggedStrongTests,
      concordance: overallResult.concordance,
      sessionCaveats: overallResult.sessionCaveats,
      testStatuses: Object.fromEntries(
        Object.entries(allTestResults || {}).map(([id, t]) => [id, t?.status])
      ),
    });
  }

  // Voice/spiral results — try allTestResults first, then legacy result prop
  const voiceResult  = (hasNewFlow ? allTestResults?.sustained_vowel?.voiceResult : null) || result?.voiceResult  || null;
  const spiralResult = (hasNewFlow ? allTestResults?.spiral_drawing?.spiralResult  : null) || result?.spiralResult || null;

  // Score fusion from analysis engine (legacy/old flow)
  const selfReportSignals = result?.signalDetails?.filter(s => s.source === 'symptoms').map(s => ({ id: s.id, weight: s.weight })) || [];
  const fusion = !hasNewFlow && (voiceResult || spiralResult) ? fuseScores(voiceResult, spiralResult, selfReportSignals) : null;

  // All dataset-grounded signal patterns from voice + spiral
  const allSignalPatterns = [
    ...(voiceResult?.signalPatterns  || []),
    ...(spiralResult?.signalPatterns || []),
  ];

  useEffect(() => {
    if (!result && !hasNewFlow) return;
    const timers = [
      setTimeout(() => setPhase(1), 80),
      setTimeout(() => setPhase(2), 300),
      setTimeout(() => setPhase(3), 600),
      setTimeout(() => setPhase(4), 900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [result, hasNewFlow]);

  if (!result && !hasNewFlow) return null;

  const sev = result ? (SEV_CONFIG[result.severityLevel] || SEV_CONFIG.none) : SEV_CONFIG.none;
  const baselineItems = result ? compareToBaseline(result.testBreakdown) : [];

  return (
    <div style={{
      backgroundColor: T.bg, minHeight: '100dvh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Severity header (legacy flow only — new flow uses clinical banner below) */}
      {result && (
      <div style={{
        ...animStyle(phase >= 1, 0),
        backgroundColor: sev.bg,
        borderBottom: `2px solid ${sev.border}`,
        padding: '28px 24px 24px',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              position: 'absolute', top: 16, right: 24,
              background: 'none', border: `1px solid ${T.border}`,
              borderRadius: 10, color: T.muted, cursor: 'pointer',
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 68, height: 68, borderRadius: 20, flexShrink: 0,
              backgroundColor: sev.color + '22', border: `2px solid ${sev.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {result.severityLevel === 'watch' ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M14 4L26 24H2L14 4z" stroke={sev.color} strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M14 12v5M14 20v1" stroke={sev.color} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="10" stroke={sev.color} strokeWidth="2"/>
                  <path d="M9 14l4 4 6-7" stroke={sev.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: F.small, fontWeight: 600, color: T.muted, letterSpacing: 0.8, marginBottom: 6 }}>
                YOUR ASSESSMENT RESULTS
              </div>
              <h1 style={{ margin: '0 0 6px', fontSize: F.h2, fontWeight: 800, color: sev.color, lineHeight: 1.2 }}>
                {sev.label}
              </h1>
              <div style={{ fontSize: F.caption, color: T.muted }}>
                {formatDate(result.date)}
              </div>
              {result.score != null && (
                <div style={{ marginTop: 14 }}>
                  <ScoreScaleBar score={result.score} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* ── CLINICAL RESULT BANNER (new 7-test flow) ── */}
        {overallResult && (() => {
          const tierColors = {
            no_indicators:           { bg: '#ECFDF5', border: '#059669', color: '#065F46' },
            some_indicators_monitor: { bg: '#FFFBEB', border: '#D97706', color: '#92400E' },
            some_indicators_followup:{ bg: '#FFFBEB', border: '#D97706', color: '#92400E' },
            multiple_indicators:     { bg: '#FFF1F2', border: '#DC2626', color: '#991B1B' },
          };
          const tc = tierColors[overallResult.resultTier] || tierColors.no_indicators;
          return (
            <div style={{ ...animStyle(phase >= 1, 0), marginBottom: 24 }}>
              {/* Result banner */}
              <div style={{
                background: tc.bg, borderBottom: `3px solid ${tc.border}`,
                padding: '24px 24px 20px', marginBottom: 20, borderRadius: '0 0 0 0',
                marginLeft: -24, marginRight: -24, marginTop: -28, paddingLeft: 24, paddingRight: 24,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tc.color, marginBottom: 6 }}>
                  OVERALL ASSESSMENT RESULT
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: tc.color, marginBottom: 8, lineHeight: 1.3 }}>
                  {overallResult.resultLabel}
                </div>
                <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.6 }}>
                  {overallResult.resultExplanation}
                </div>
              </div>

              {/* Session conditions — immediately visible below overall result */}
              {overallResult.sessionCaveats.length > 0 && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: 16, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#92400E', marginBottom: 10 }}>
                    SESSION CONDITIONS
                  </div>
                  {overallResult.sessionCaveats.map((c, i) => (
                    <div key={i} style={{ fontSize: 14, color: '#92400E', padding: '4px 0', lineHeight: 1.5 }}>
                      {c}
                    </div>
                  ))}
                  {overallResult.retestRecommendation.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {overallResult.retestRecommendation.map((r, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#B45309', fontStyle: 'italic', lineHeight: 1.5 }}>{r}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 8 }}>
                    These conditions may affect today's reliability. They do not change your result.
                  </div>
                </div>
              )}

              {/* Strong tests */}
              <div style={{
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>
                  STRONG TEST RESULTS
                </div>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: '#94A3B8', marginBottom: 14 }}>
                  These three tests drive the overall conclusion
                </div>
                {['sustained_vowel', 'rest_tremor', 'finger_tapping'].map(tid => {
                  const tr = allTestResults[tid];
                  const status = tr?.status || 'unknown';
                  return (
                    <div key={tid} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: tid !== 'finger_tapping' ? '1px solid #F1F5F9' : 'none',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
                        {STRONG_TEST_LABELS[tid]}
                      </div>
                      <StatusBadge status={status} />
                    </div>
                  );
                })}
              </div>

              {/* Concordant findings (conditional) */}
              {overallResult.hasConcordance && (
                <div style={{
                  background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 12, padding: 16, marginBottom: 16,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0F766E', marginBottom: 10 }}>
                    CONCORDANT FINDINGS
                  </div>
                  {overallResult.concordance.hasAsymmetry && (
                    <div style={{ fontSize: 14, color: '#134E4A', padding: '6px 0', borderBottom: '1px solid #CCFBF1' }}>
                      Asymmetric findings detected across motor tests
                    </div>
                  )}
                  {overallResult.concordance.hasVoiceMotorMatch && (
                    <div style={{ fontSize: 14, color: '#134E4A', padding: '6px 0', borderBottom: '1px solid #CCFBF1' }}>
                      Voice and motor tests both flagged
                    </div>
                  )}
                  {overallResult.concordance.hasProdromalMatch && (
                    <div style={{ fontSize: 14, color: '#134E4A', padding: '6px 0' }}>
                      Two or more prodromal markers reported in profile
                    </div>
                  )}
                </div>
              )}

              {/* Supporting tests (collapsible) */}
              <div style={{
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setShowSupporting(s => !s)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B' }}>
                    SUPPORTING TEST INSIGHTS
                  </div>
                  <span style={{ fontSize: 13, color: T.accent, fontWeight: 600 }}>
                    {showSupporting ? 'Hide' : 'Show details'}
                  </span>
                </button>
                {showSupporting && (
                  <div style={{ padding: '0 16px 16px' }}>
                    {['pataka', 'reading_passage', 'spiral_drawing', 'reaction_time'].map(tid => {
                      const tr = allTestResults[tid];
                      const status = tr?.status || 'unknown';
                      return (
                        <div key={tid} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 0', borderBottom: tid !== 'reaction_time' ? '1px solid #F1F5F9' : 'none',
                        }}>
                          <div style={{ fontSize: 14, color: '#0F172A' }}>
                            {SUPPORTING_TEST_LABELS[tid]}
                          </div>
                          <StatusBadge status={status} />
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 13, fontStyle: 'italic', color: '#94A3B8', marginTop: 10 }}>
                      Supporting results add context but do not drive the overall conclusion.
                    </div>
                  </div>
                )}
              </div>

              {/* View detailed graphs toggle */}
              <button
                onClick={() => setShowGraphs(prev => !prev)}
                style={{
                  display: 'block',
                  margin: '16px auto',
                  background: 'white',
                  border: `1.5px solid ${T.accent}`,
                  borderRadius: 28,
                  padding: '12px 28px',
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.accent,
                  cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {showGraphs ? 'Hide graphs' : 'View detailed graphs'}
              </button>

              {/* Detailed graph cards */}
              {showGraphs && allTestResults && (() => {
                const GRAPH_MAP = {
                  sustained_vowel: VoiceStabilityGraph,
                  pataka: SyllableRateGraph,
                  reading_passage: SpeechRateGraph,
                  finger_tapping: TappingIntervalGraph,
                  spiral_drawing: SpiralDeviationGraph,
                  reaction_time: ReactionTimeHistogram,
                  rest_tremor: TremorPowerGraph,
                };
                const LABELS = {
                  sustained_vowel: 'Sustained Vowel', pataka: 'Syllable Repetition',
                  reading_passage: 'Reading Passage', finger_tapping: 'Finger Tapping',
                  spiral_drawing: 'Spiral Drawing', reaction_time: 'Reaction Time', rest_tremor: 'Rest Tremor',
                };
                return Object.entries(allTestResults).map(([id, tr]) => {
                  const GraphComp = GRAPH_MAP[id];
                  if (!GraphComp || !tr) return null;
                  return (
                    <div key={id} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>{LABELS[id] || id}</div>
                      <GraphComp
                        rawValues={tr.rawValues}
                        {...(id === 'spiral_drawing' ? { spiralImageDataUrl: tr.spiralImageDataUrl ?? null } : {})}
                      />
                    </div>
                  );
                });
              })()}

              {/* Disclaimer */}
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5, padding: '0 4px' }}>
                {overallResult.disclaimer}
              </div>
            </div>
          );
        })()}

        {/* What this means (legacy flow only) */}
        {result && (
        <div style={{ ...animStyle(phase >= 2, 0), marginBottom: 24 }}>
          <div style={{
            backgroundColor: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
          }}>
            <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 12 }}>
              WHAT THIS MEANS
            </div>
            <p style={{ margin: '0 0 12px', fontSize: F.body, color: T.text, lineHeight: 1.7 }}>
              {sev.plainText}
            </p>
            {result.explanation && result.explanation !== sev.plainText && (
              <p style={{ margin: 0, fontSize: F.label, color: T.textSec, lineHeight: 1.7 }}>
                {result.explanation}
              </p>
            )}
          </div>
        </div>
        )}

        {/* Comparison to baseline */}
        {baselineItems.length > 0 && (
          <div style={{ ...animStyle(phase >= 2, 60), marginBottom: 24 }}>
            <div style={{
              backgroundColor: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
            }}>
              <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 20 }}>
                COMPARISON TO PUBLISHED REFERENCE RANGES
              </div>
              {baselineItems.map(item => (
                <BaselineBar key={item.key} item={item} />
              ))}
              <p style={{ margin: '8px 0 0', fontSize: 11, color: T.faint, lineHeight: 1.5 }}>
                Reference ranges based on published Parkinson's awareness literature (MDS-UPDRS III, Baken & Orlikoff 2000, Pullman 1998). These ranges are educational and not diagnostic thresholds — consult a neurologist for clinical evaluation.
              </p>
            </div>
          </div>
        )}

        {/* Fusion summary card */}
        {fusion && (
          <div style={{ ...animStyle(phase >= 2, 90), marginBottom: 24 }}>
            <div style={{
              backgroundColor: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
            }}>
              <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 16 }}>
                COMBINED SCREENING SIGNAL
              </div>
              <ScoreScaleBar score={Math.round(fusion.combinedScore * 100)} />
              <div style={{ marginTop: 12, fontSize: 13, color: T.muted }}>
                {fusion.modalities.length} modalit{fusion.modalities.length === 1 ? 'y' : 'ies'} assessed — {fusion.concordance} concordance
                {fusion.modalities.length < 2 && (
                  <span style={{ display: 'block', fontStyle: 'italic', marginTop: 4 }}>
                    Complete additional tests to improve pattern confidence.
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>Confidence: {fusion.confidence}</div>
              <p style={{ margin: '10px 0 0', fontSize: F.label, color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>
                {fusion.summary}
              </p>
            </div>
          </div>
        )}

        {/* Reference ranges card (voice + spiral signal patterns) */}
        {allSignalPatterns.length > 0 && (
          <div style={{ ...animStyle(phase >= 3, 0), marginBottom: 24 }}>
            <div style={{
              backgroundColor: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
            }}>
              <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 12 }}>
                COMPARISON TO REFERENCE RANGES
              </div>
              <p style={{ margin: '0 0 20px', fontSize: 15, color: '#475569', lineHeight: 1.6 }}>
                The values below compare your results to reference ranges derived from published research.
                These are educational comparison ranges — not diagnostic thresholds.
              </p>
              {allSignalPatterns.map((pattern, i) => {
                const statusColor = pattern.status === 'within_range' ? '#059669' : pattern.status === 'worth_monitoring' ? '#D97706' : '#DC2626';
                const barWidth = pattern.status === 'within_range' ? '70%' : pattern.status === 'worth_monitoring' ? '50%' : '85%';
                const statusLabel = pattern.status === 'within_range' ? 'Within range' : pattern.status === 'worth_monitoring' ? 'Worth monitoring' : 'Outside range';
                return (
                  <div key={i} style={{ marginBottom: i < allSignalPatterns.length - 1 ? 20 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{pattern.metric}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18, color: statusColor, fontWeight: 700 }}>{pattern.value}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, backgroundColor: statusColor + '18', padding: '6px 16px', borderRadius: 100, border: `1px solid ${statusColor}33` }}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 8, backgroundColor: T.bg, borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                      <div style={{ height: '100%', backgroundColor: statusColor, borderRadius: 10, width: barWidth, opacity: 0.85 }} />
                    </div>
                    <div style={{ fontSize: 14, color: '#6B7280', marginTop: 5, lineHeight: 1.5 }}>{pattern.reference}</div>
                  </div>
                );
              })}
              <p style={{ margin: '20px 0 0', fontSize: 13, color: '#94A3B8', fontStyle: 'italic', borderTop: `1px solid ${T.border}`, paddingTop: 12, lineHeight: 1.5 }}>
                Reference ranges are based on UCI Oxford Parkinson's dataset (Little et al. 2008) and published Parkinson's awareness literature (Baken & Orlikoff 2000, Pullman 1998).
                These are educational comparison ranges and are not diagnostic thresholds. Individual variation is normal.
              </p>
            </div>
          </div>
        )}

        {/* Voice screening result card */}
        {voiceResult && (() => {
          const vs = voiceResult.voiceScore ?? null;
          const vsLabel = vs == null ? 'Analysis complete'
            : vs <= 0.33 ? 'Within expected range'
            : vs <= 0.66 ? 'Mild irregularities detected'
            : 'Pattern worth monitoring';
          const vsColor  = vs == null || vs <= 0.33 ? '#059669' : vs <= 0.66 ? '#D97706' : '#DC2626';
          const vsBg     = vs == null || vs <= 0.33 ? '#ECFDF5' : vs <= 0.66 ? '#FFFBEB' : '#FFF1F2';
          const vsBorder = vs == null || vs <= 0.33 ? '#A7F3D0' : vs <= 0.66 ? '#FCD34D' : '#FECDD3';
          const vsText   = vs == null ? 'Voice recording completed.'
            : vs <= 0.33 ? 'Phonation duration, stability, and energy patterns are within typical ranges.'
            : vs <= 0.66 ? 'Some variation in vocal stability was detected. Worth tracking over time.'
            : 'Multiple voice patterns suggest irregularities worth discussing with a healthcare professional.';
          return (
            <div style={{ ...animStyle(phase >= 3, 40), marginBottom: 24 }}>
              <div style={{
                backgroundColor: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
              }}>
                {/* PRIMARY: General result */}
                <div style={{ backgroundColor: vsBg, borderBottom: `1px solid ${vsBorder}`, padding: 24 }}>
                  <div style={{ fontSize: F.small, fontWeight: 700, color: vsColor, letterSpacing: 0.8, marginBottom: 8 }}>
                    VOICE SCREENING RESULT
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: vsColor, marginBottom: 10 }}>{vsLabel}</div>
                  <p style={{ margin: 0, fontSize: F.label, color: '#374151', lineHeight: 1.6 }}>{vsText}</p>
                  {vs != null && (
                    <div style={{ marginTop: 10, fontSize: 12, color: vsColor, fontWeight: 600 }}>
                      Weighted concern index: {Math.round(vs * 100)}%
                    </div>
                  )}
                </div>
                {/* SECONDARY: Gemini pattern details */}
                {voiceResult.geminiAnalysis && (
                  <div style={{ padding: 24 }}>
                    <div style={{ fontSize: F.small, fontWeight: 600, color: T.muted, letterSpacing: 0.6, marginBottom: 10 }}>
                      PATTERN DETAILS
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: F.label, color: '#334155', lineHeight: 1.7 }}>
                      {voiceResult.geminiAnalysis.patternNote}
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: F.caption, color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>
                      {voiceResult.geminiAnalysis.phonationDurationNote}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', fontStyle: 'italic', lineHeight: 1.5 }}>
                      {voiceResult.limitation}
                    </p>
                  </div>
                )}
                {!voiceResult.geminiAnalysis && voiceResult.limitation && (
                  <div style={{ padding: '0 24px 24px' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', fontStyle: 'italic', lineHeight: 1.5 }}>
                      {voiceResult.limitation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* What we checked (legacy flow only) */}
        {result && (
        <div style={{ ...animStyle(phase >= 3, 0), marginBottom: 24 }}>
          <div style={{
            backgroundColor: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
          }}>
            <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 16 }}>
              WHAT WE CHECKED
            </div>
            {Object.entries(TEST_META).map(([key, meta], i, arr) => (
              <TestRow
                key={key}
                meta={meta}
                t={result.testBreakdown?.[key]}
                last={i === arr.length - 1}
              />
            ))}
          </div>
        </div>
        )}

        {/* Recommended action */}
        {result?.preventiveShortcut && (
          <div style={{ ...animStyle(phase >= 3, 80), marginBottom: 24 }}>
            <div style={{
              backgroundColor: T.surface, border: `1px solid ${T.border}`,
              borderLeft: `4px solid ${T.accent}`,
              borderRadius: '0 16px 16px 0', padding: 24,
              boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
            }}>
              <div style={{ fontSize: F.small, fontWeight: 700, color: T.accent, letterSpacing: 0.8, marginBottom: 10 }}>
                RECOMMENDED ACTION
              </div>
              <p style={{ margin: 0, fontSize: F.body, color: T.text, lineHeight: 1.7 }}>
                {result.preventiveShortcut}
              </p>
            </div>
          </div>
        )}

        {/* Exercise recommendation */}
        {result?.exerciseRecommendation && (
          <div style={{ ...animStyle(phase >= 3, 120), marginBottom: 24 }}>
            <div style={{
              backgroundColor: T.greenBg, border: `1px solid ${T.greenBorder}`,
              borderLeft: `4px solid ${T.green}`,
              borderRadius: '0 16px 16px 0', padding: 24,
            }}>
              <div style={{ fontSize: F.small, fontWeight: 700, color: T.green, letterSpacing: 0.8, marginBottom: 10 }}>
                EXERCISE RECOMMENDATION
              </div>
              <p style={{ margin: 0, fontSize: F.body, color: T.textSec, lineHeight: 1.7 }}>
                {result.exerciseRecommendation}
              </p>
            </div>
          </div>
        )}

        {/* Next steps — dynamic tier-based (new flow) or static (legacy flow) */}
        <div style={{ ...animStyle(phase >= 4, 0), marginBottom: 24 }}>
          {overallResult ? (() => {
            const STEPS = {
              no_indicators: [
                'Maintain regular aerobic exercise — 30 minutes per day.',
                'Track changes with monthly reassessments.',
                'Schedule a routine GP check-up within 6 months.',
              ],
              some_indicators_monitor: [
                'Retest within 4 weeks to track changes.',
                'Begin a daily aerobic exercise programme.',
                'Note any new symptoms between sessions.',
              ],
              some_indicators_followup: [
                'Share these results with your GP at your next appointment.',
                'Schedule a follow-up assessment in 2–4 weeks.',
                'Start a structured exercise programme.',
              ],
              multiple_indicators: [
                'Book an appointment with your GP within 2 weeks.',
                'Bring this report to your appointment.',
                'Begin a structured exercise programme — consider Rock Steady Boxing.',
              ],
            };
            const ACCENT = {
              no_indicators: '#065F46', some_indicators_monitor: '#92400E',
              some_indicators_followup: '#9A3412', multiple_indicators: '#991B1B',
            };
            const steps = STEPS[overallResult.resultTier] || STEPS.no_indicators;
            const accent = ACCENT[overallResult.resultTier] || '#065F46';
            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Next Steps</div>
                {steps.map((step, i) => (
                  <div
                    key={i}
                    onClick={() => setCheckedSteps(prev => ({ ...prev, [i]: !prev[i] }))}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      borderLeft: `4px solid ${accent}`,
                      background: 'white',
                      borderRadius: 8,
                      padding: '14px 18px',
                      fontSize: 15,
                      color: '#0F172A',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, border: `2px solid ${checkedSteps[i] ? accent : '#CBD5E1'}`,
                      borderRadius: 4, flexShrink: 0, marginTop: 1,
                      background: checkedSteps[i] ? accent : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {checkedSteps[i] && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>V</span>}
                    </div>
                    <span style={{ textDecoration: 'none' }}>{step}</span>
                  </div>
                ))}
              </div>
            );
          })() : (
            <div style={{
              backgroundColor: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
            }}>
              <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 16 }}>
                NEXT STEPS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sev.nextSteps.map(({ text, action }, i) => {
                  const done = actionTaken.has(i);
                  function handleAction() {
                    setActionTaken(prev => new Set([...prev, i]));
                    if (action === 'schedule') openGoogleCalendar();
                    else if (action === 'export') onExport();
                    else if (action === 'retake') onRetake?.();
                    else if (action === 'history') onViewHistory?.();
                    else if (action === 'exercise') setShowExerciseTip(t => !t);
                  }
                  return (
                    <button
                      key={i}
                      onClick={handleAction}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        width: '100%', minHeight: 52,
                        backgroundColor: done ? (T.greenBg || '#ECFDF5') : T.bg,
                        border: `1px solid ${done ? '#A7F3D0' : T.border}`,
                        borderRadius: 12, padding: '12px 16px',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'system-ui, sans-serif',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        backgroundColor: done ? '#059669' : T.accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                      }}>
                        {done ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 7l3.5 3.5 5.5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : ACTION_ICONS[action]}
                      </div>
                      <span style={{
                        flex: 1, fontSize: F.label, color: done ? '#059669' : T.textSec,
                        fontWeight: done ? 600 : 400, lineHeight: 1.5,
                      }}>
                        {text}
                      </span>
                      {!done && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: T.faint }}>
                          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {showExerciseTip && (
                <div style={{
                  marginTop: 14, padding: '14px 16px',
                  backgroundColor: T.greenBg || '#ECFDF5', border: '1px solid #A7F3D0',
                  borderRadius: 10, fontSize: F.caption, color: '#065F46', lineHeight: 1.6,
                }}>
                  {EXERCISE_TIP}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Consultation card */}
        <div style={{ ...animStyle(phase >= 4, 40), marginBottom: 24 }}>
          <div style={{
            backgroundColor: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
          }}>
            <div style={{ fontSize: F.small, fontWeight: 700, color: T.muted, letterSpacing: 0.8, marginBottom: 10 }}>
              SCHEDULE WITH YOUR DOCTOR
            </div>
            <p style={{ margin: '0 0 16px', fontSize: F.label, color: T.textSec, lineHeight: 1.6 }}>
              Plan a conversation with your healthcare professional by creating a calendar event.
            </p>
            <button
              onClick={() => openGoogleCalendar()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                backgroundColor: T.accent, color: '#fff', border: 'none',
                borderRadius: 100, height: 52, padding: '0 24px', width: '100%',
                fontSize: F.label, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="16" height="16" rx="2.5" stroke="white" strokeWidth="1.5"/>
                <line x1="1" y1="6" x2="17" y2="6" stroke="white" strokeWidth="1.5"/>
                <line x1="6" y1="1" x2="6" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="12" y1="1" x2="12" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="4" y="9" width="3" height="3" rx="0.5" fill="white"/>
                <rect x="7.5" y="9" width="3" height="3" rx="0.5" fill="white"/>
              </svg>
              Schedule on Google Calendar
            </button>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: T.faint, lineHeight: 1.5 }}>
              Opens Google Calendar with your assessment details pre-filled. Add your doctor's email to invite them.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ ...animStyle(phase >= 4, 60), marginBottom: 28 }}>
          <DisclaimerBlock screen="results" />
        </div>

        {/* Action buttons */}
        <div style={{ ...animStyle(phase >= 4, 120), display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => exportToPdf({ allTestResults, sessionAnswers, profileAnswers })}
              style={{ ...btnGhost, flex: 1 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M8 11V3M8 3L5.5 5.5M8 3l2.5 2.5" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.5 13v1a.5.5 0 00.5.5h10a.5.5 0 00.5-.5v-1" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Export PDF
            </button>
            <button onClick={onBackToDashboard} style={{ ...btnPrimary(false), flex: 2 }}>
              Go to dashboard
            </button>
          </div>
          <button
            onClick={onContinue}
            style={{
              background: 'none', border: 'none', color: T.accent,
              fontSize: F.label, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif', padding: '12px 0',
              minHeight: 48, textAlign: 'center',
            }}
          >
            Start another assessment
          </button>
        </div>
      </div>
    </div>
  );
}
