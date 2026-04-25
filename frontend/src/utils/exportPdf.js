import { computeOverallResult } from './scoringEngine.js';

export function openPrintWindow(html) {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site to export the report.');
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(() => { win.focus(); win.print(); URL.revokeObjectURL(url); }, 600);
    return true;
  } catch {
    alert('Could not open print window.');
    return false;
  }
}

const SEV_LABELS = {
  watch:  'Notable signal level',
  medium: 'Moderate signal level',
  low:    'Low signal level',
  none:   'No signals detected',
};

const STATUS_LABELS = {
  in_range:    'In range',
  borderline:  'Borderline',
  out_of_range:'Outside range',
  skipped:     'Skipped',
  unknown:     'Not taken',
};

const STRONG_TEST_NAMES = {
  sustained_vowel: 'Sustained Vowel (Voice)',
  rest_tremor:     'Rest Tremor',
  finger_tapping:  'Finger Tapping',
};

const SUPPORT_TEST_NAMES = {
  pataka:          'Pa-Ta-Ka Speech',
  reading_passage: 'Reading Passage',
  spiral_drawing:  'Spiral Drawing',
  reaction_time:   'Reaction Time',
};

function fmtMetrics(testId, tr) {
  if (!tr?.rawValues) return '—';
  const rv = tr.rawValues;
  if (testId === 'sustained_vowel') return `Duration: ${rv.phonationTime?.toFixed(1) ?? '—'}s · CV: ${rv.amplitudeCV?.toFixed(2) ?? '—'}`;
  if (testId === 'rest_tremor')     return `Tremor ratio: ${rv.power_ratio_3_7hz?.toFixed(3) ?? '—'}`;
  if (testId === 'finger_tapping')  return `ITI: ${rv.mean_intertap_ms?.toFixed(0) ?? '—'}ms · CV: ${rv.interval_cv?.toFixed(2) ?? '—'}`;
  if (testId === 'pataka')          return `Rate: ${rv.syllable_rate?.toFixed(1) ?? '—'} syl/s · Rhythm CV: ${rv.rhythm_cv?.toFixed(2) ?? '—'}`;
  if (testId === 'reading_passage') return `${rv.speech_rate_wpm?.toFixed(0) ?? '—'} wpm · Pause ratio: ${rv.pause_ratio?.toFixed(2) ?? '—'}`;
  if (testId === 'spiral_drawing')  return `Irregularity: ${rv.irregularity != null ? (rv.irregularity * 100).toFixed(0) + '%' : '—'}`;
  if (testId === 'reaction_time')   return `Mean RT: ${rv.mean_rt_ms?.toFixed(0) ?? '—'}ms`;
  return '—';
}

function statusCell(status) {
  const colors = {
    in_range:    { bg: '#ECFDF5', color: '#065F46' },
    borderline:  { bg: '#FFFBEB', color: '#92400E' },
    out_of_range:{ bg: '#FFF1F2', color: '#991B1B' },
    unknown:     { bg: '#F1F5F9', color: '#64748B' },
  };
  const c = colors[status] || colors.unknown;
  const label = STATUS_LABELS[status] || status;
  return `<span style="background:${c.bg};color:${c.color};border-radius:100px;padding:3px 12px;font-size:12px;font-weight:700">${label}</span>`;
}

export function exportToPdf({
  allTestResults = {},
  sessionAnswers = null,
  profileAnswers = null,
  allAnalyses = [],
} = {}) {
  const hasNewFlow = allTestResults && Object.keys(allTestResults).length > 0;
  if (!hasNewFlow) return false;

  const overallResult = computeOverallResult(allTestResults, profileAnswers, sessionAnswers);
  const spiralImageDataUrl = allTestResults?.spiral_drawing?.spiralImageDataUrl ?? null;

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Overall result block ─────────────────────────────────────────────────
  const TIER_COLORS = {
    no_indicators:           { bg: '#ECFDF5', accent: '#059669', text: '#065F46' },
    some_indicators_monitor: { bg: '#FFFBEB', accent: '#D97706', text: '#92400E' },
    some_indicators_followup:{ bg: '#FFF7ED', accent: '#EA580C', text: '#9A3412' },
    multiple_indicators:     { bg: '#FFF1F2', accent: '#DC2626', text: '#991B1B' },
  };

  const tc = TIER_COLORS[overallResult.resultTier] || TIER_COLORS.no_indicators;
  const overallSection = `<div style="background:${tc.bg};border-left:4px solid ${tc.accent};border-radius:0 10px 10px 0;padding:20px 24px;margin-bottom:28px">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${tc.text};margin-bottom:6px">OVERALL RESULT</div>
    <div style="font-size:22px;font-weight:800;color:${tc.text};margin-bottom:8px">${overallResult.resultLabel}</div>
    <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">${overallResult.resultExplanation}</p>
  </div>`;

  // ── Strong tests table ───────────────────────────────────────────────────
  const strongRows = Object.entries(STRONG_TEST_NAMES).map(([tid, label]) => {
    const tr     = allTestResults?.[tid];
    const status = tr?.status || 'unknown';
    const metric = fmtMetrics(tid, tr);
    return `<tr>
      <td style="padding:10px 14px;font-weight:600;color:#0F172A">${label}</td>
      <td style="padding:10px 14px">${statusCell(status)}</td>
      <td style="padding:10px 14px;font-size:13px;color:#64748B">${metric}</td>
    </tr>`;
  }).join('');

  // ── Supporting tests table ───────────────────────────────────────────────
  const supportRows = Object.entries(SUPPORT_TEST_NAMES).map(([tid, label]) => {
    const tr     = allTestResults?.[tid];
    const status = tr?.status || 'unknown';
    const metric = fmtMetrics(tid, tr);
    return `<tr>
      <td style="padding:10px 14px;font-weight:600;color:#0F172A">${label}</td>
      <td style="padding:10px 14px">${statusCell(status)}</td>
      <td style="padding:10px 14px;font-size:13px;color:#64748B">${metric}</td>
    </tr>`;
  }).join('');

  // ── History rows ─────────────────────────────────────────────────────────
  const histRows = allAnalyses.slice(0, 10).map(a => {
    const d  = a.date ? new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const lb = SEV_LABELS[a.severityLevel] || '—';
    const sc = a.score ?? '—';
    const sg = (a.detectedSignals || []).map(s => s.replace(/_/g, ' ')).join(', ') || 'None';
    return `<tr>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${d}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#374151">${lb}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${sc}</td>
      <td style="padding:8px 12px;font-size:12px;color:#64748B">${sg}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="color:#94A3B8;padding:8px 12px">No history available</td></tr>';

  // ── Concordant findings ──────────────────────────────────────────────────
  const concordItems = [
    overallResult.concordance?.hasAsymmetry ? 'Asymmetric findings across motor tests' : '',
    overallResult.concordance?.hasVoiceMotorMatch ? 'Voice and motor tests both flagged' : '',
    overallResult.concordance?.hasProdromalMatch ? 'Two or more prodromal markers reported in profile' : '',
  ].filter(Boolean);

  const concordSection = concordItems.length > 0
    ? `<div class="section-title">Concordant findings</div>
       <ul>${concordItems.map(c => `<li>${c}</li>`).join('')}</ul>`
    : '';

  // ── Session caveats ──────────────────────────────────────────────────────
  const caveatsSection = overallResult?.sessionCaveats?.length > 0
    ? `<div class="section-title">Session conditions</div>
       <ul>${overallResult.sessionCaveats.map(c => `<li>${c}</li>`).join('')}</ul>
       <p style="font-size:12px;color:#94A3B8;font-style:italic">These conditions may affect today's reliability.</p>`
    : '';

  // ── Session raw answers ──────────────────────────────────────────────────
  const sessionRawSection = sessionAnswers ? (() => {
    const sa = sessionAnswers;
    const rows = [
      ['Sleep (last night)',  sa.sleep_hours != null ? `${sa.sleep_hours} hours` : 'Not provided'],
      ['Caffeine today',      sa.had_caffeine  ? 'Yes' : 'No'],
      ['Alcohol (24h)',       sa.had_alcohol   ? 'Yes' : 'No'],
      ['Noisy environment',   sa.environment   ? 'Yes' : 'Quiet'],
      ['Age group',          sa.age_65_or_older   ? '65 or older' : 'Under 65'],
    ].map(([label, value]) => `<tr>
      <td style="padding:7px 14px;font-size:13px;color:#334155;font-weight:600;width:50%">${label}</td>
      <td style="padding:7px 14px;font-size:13px;color:#334155">${value}</td>
    </tr>`).join('');
    return `<div class="section-title">Session Conditions</div>
      <table style="margin-bottom:4px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#94A3B8;font-style:italic;margin-top:6px">
        These conditions may influence measurement reliability but do not change the screening result.
      </p>`;
  })() : '';

  // ── PDF zone gauge helper ────────────────────────────────────────────────
  // zones: [{ upTo (upper bound on same scale as value/maxValue), bg, label, labelColor }]
  // Zones must be ordered lowest→highest upTo; last upTo should equal maxValue.
  function pdfZoneGauge({ label, value, displayValue, minValue = 0, maxValue, zones, referenceText = '' }) {
    const scale = maxValue - minValue;
    const clampedValue = Math.min(maxValue, Math.max(minValue, value ?? minValue));
    const markerPct = ((clampedValue - minValue) / scale) * 100;

    let prevUpTo = minValue;
    const zoneSegments = zones.map(z => {
      const segWidth = ((z.upTo - prevUpTo) / scale) * 100;
      prevUpTo = z.upTo;
      return { ...z, widthPct: segWidth };
    });

    const zonesHtml = zoneSegments.map((z, i) => {
      const isFirst = i === 0;
      const isLast  = i === zoneSegments.length - 1;
      const radius  = isFirst && isLast ? '10px'
                    : isFirst           ? '10px 0 0 10px'
                    : isLast            ? '0 10px 10px 0'
                    : '0';
      return `<div style="width:${z.widthPct.toFixed(3)}%;height:20px;background:${z.bg};flex-shrink:0;border-radius:${radius}"></div>`;
    }).join('');
    const zoneLabelsHtml = zoneSegments.map(z =>
      `<div style="width:${z.widthPct.toFixed(3)}%;text-align:center;font-size:10px;color:${z.labelColor};font-weight:600;padding-top:3px;white-space:nowrap;overflow:hidden;flex-shrink:0">${z.label}</div>`
    ).join('');

    return `<div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:#374151">${label}</span>
        <span style="font-size:14px;font-weight:700;color:#111827">${displayValue}</span>
      </div>
      <div style="position:relative;width:100%;height:20px;display:flex">
        ${zonesHtml}
        <div style="position:absolute;top:0;left:calc(${markerPct.toFixed(2)}% - 1.5px);width:3px;height:20px;background:#111827;border-radius:2px"></div>
      </div>
      <div style="display:flex;width:100%;margin-top:3px">${zoneLabelsHtml}</div>
      ${referenceText ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">${referenceText}</div>` : ''}
    </div>`;
  }

  function pdfTappingDots(intervals, label) {
    if (!intervals || intervals.length === 0) return '';
    const dots = intervals.map(ms => {
      const c = ms <= 250 ? '#059669' : ms <= 350 ? '#D97706' : '#DC2626';
      return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};margin:2px;vertical-align:middle"></span>`;
    }).join('');
    return `<div style="margin-bottom:12px">
      <div style="font-size:12px;color:#6B7280;margin-bottom:4px">${label} (${intervals.length} taps)</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center">${dots}</div>
    </div>`;
  }

  function pdfSpeechPaired(wpm, pauseRatio) {
    const wpmGauge = pdfZoneGauge({
      label: 'Speech rate', value: wpm, displayValue: wpm.toFixed(0) + ' wpm',
      minValue: 0, maxValue: 300,
      zones: [
        { upTo: 100, bg: '#FCA5A5', label: '<100',    labelColor: '#DC2626' },
        { upTo: 130, bg: '#FDE68A', label: '100–130', labelColor: '#D97706' },
        { upTo: 200, bg: '#A7F3D0', label: '130–200', labelColor: '#059669' },
        { upTo: 250, bg: '#FDE68A', label: '200–250', labelColor: '#D97706' },
        { upTo: 300, bg: '#FCA5A5', label: '>250',    labelColor: '#DC2626' },
      ],
      referenceText: '130–200 wpm in range',
    });
    const prColor = pauseRatio < 0.25 ? '#059669' : pauseRatio < 0.35 ? '#D97706' : '#DC2626';
    const prFillPct = Math.min(100, pauseRatio * 100).toFixed(1);
    return `<div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:18px">
      <div style="flex:3">${wpmGauge}</div>
      <div style="flex:1;text-align:center">
        <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Pause ratio</div>
        <div style="display:inline-block;position:relative;width:36px;height:72px;background:#E5E7EB;border-radius:6px;overflow:hidden;vertical-align:top">
          <div style="position:absolute;bottom:0;left:0;right:0;background:${prColor};height:${prFillPct}%"></div>
        </div>
        <div style="font-size:14px;font-weight:700;color:${prColor};margin-top:4px">${(pauseRatio * 100).toFixed(1)}%</div>
        <div style="font-size:11px;color:#94A3B8">&lt;25% in range</div>
      </div>
    </div>`;
  }

  function pdfSectionHeader(title) {
    return `<div style="font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E5E7EB">${title}</div>`;
  }

  // ── Visual graph sections (all 7 tests) ──────────────────────────────────
  let graphSections = '';
  if (hasNewFlow) {
    // Voice
    const voiceRV = allTestResults?.sustained_vowel?.rawValues;
    if (voiceRV && voiceRV.rmsEnergy != null && voiceRV.rmsEnergy > 0) {
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Voice — Acoustic Measurements')}
        ${pdfZoneGauge({ label: 'RMS Energy (loudness)', value: voiceRV.rmsEnergy, displayValue: Number(voiceRV.rmsEnergy).toFixed(4),
          minValue: 0, maxValue: 0.20,
          zones: [{ upTo: 0.01, bg: '#FCA5A5', label: '< 0.01',           labelColor: '#DC2626' },
                  { upTo: 0.04, bg: '#FDE68A', label: '0.01–0.04',        labelColor: '#D97706' },
                  { upTo: 0.20, bg: '#A7F3D0', label: '≥ 0.04 in range',  labelColor: '#059669' }],
          referenceText: '≥ 0.04 in range · 0.01–0.04 borderline · < 0.01 out of range' })}
        ${voiceRV.silenceRatio != null ? pdfZoneGauge({ label: 'Silence Ratio', value: voiceRV.silenceRatio, displayValue: Number(voiceRV.silenceRatio * 100).toFixed(1) + '%',
          minValue: 0, maxValue: 1.0,
          zones: [{ upTo: 0.40, bg: '#A7F3D0', label: '< 40% in range',    labelColor: '#059669' },
                  { upTo: 0.65, bg: '#FDE68A', label: '40–65%',             labelColor: '#D97706' },
                  { upTo: 1.00, bg: '#FCA5A5', label: '> 65% out of range', labelColor: '#DC2626' }] }) : ''}
        ${voiceRV.energyVariance != null ? pdfZoneGauge({ label: 'Energy Variance (stability)', value: voiceRV.energyVariance || 0, displayValue: Number(voiceRV.energyVariance || 0).toFixed(6),
          minValue: 0, maxValue: 0.015,
          zones: [{ upTo: 0.002, bg: '#A7F3D0', label: '< 0.002 stable',   labelColor: '#059669' },
                  { upTo: 0.008, bg: '#FDE68A', label: '0.002–0.008',       labelColor: '#D97706' },
                  { upTo: 0.015, bg: '#FCA5A5', label: '> 0.008 irregular', labelColor: '#DC2626' }],
          referenceText: '< 0.002 in range · 0.002–0.008 borderline · > 0.008 out of range' }) : ''}
      </div>`;
    }

    // Tapping
    const tapRV = allTestResults?.finger_tapping?.rawValues;
    if (tapRV && tapRV.mean_intertap_ms != null) {
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Finger Tapping — Interval Distribution')}
        ${pdfZoneGauge({ label: 'Mean inter-tap interval', value: tapRV.mean_intertap_ms, displayValue: Number(tapRV.mean_intertap_ms).toFixed(0) + ' ms',
          minValue: 0, maxValue: 500,
          zones: [{ upTo: 250, bg: '#A7F3D0', label: '≤ 250ms in range',      labelColor: '#059669' },
                  { upTo: 350, bg: '#FDE68A', label: '250–350ms',              labelColor: '#D97706' },
                  { upTo: 500, bg: '#FCA5A5', label: '> 350ms out of range',   labelColor: '#DC2626' }],
          referenceText: '150–250ms in range · 250–350ms borderline · > 350ms out of range' })}
        ${tapRV.interval_cv != null ? pdfZoneGauge({ label: 'Interval variability (CV)', value: tapRV.interval_cv || 0, displayValue: Number(tapRV.interval_cv || 0).toFixed(3),
          minValue: 0, maxValue: 0.50,
          zones: [{ upTo: 0.15, bg: '#A7F3D0', label: '< 0.15 in range',      labelColor: '#059669' },
                  { upTo: 0.25, bg: '#FDE68A', label: '0.15–0.25',             labelColor: '#D97706' },
                  { upTo: 0.50, bg: '#FCA5A5', label: '> 0.25 out of range',   labelColor: '#DC2626' }],
          referenceText: '< 0.15 in range · 0.15–0.25 borderline · > 0.25 out of range' }) : ''}
        ${pdfTappingDots(tapRV.dominantIntervals, 'Dominant hand taps')}
        ${pdfTappingDots(tapRV.nondominantIntervals, 'Non-dominant hand taps')}
      </div>`;
    }

    // Pa-Ta-Ka
    const patakaRV = allTestResults?.pataka?.rawValues;
    if (patakaRV && patakaRV.syllable_rate != null) {
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Pa-Ta-Ka — Speech Motor Control')}
        ${pdfZoneGauge({ label: 'Syllable rate', value: patakaRV.syllable_rate, displayValue: Number(patakaRV.syllable_rate).toFixed(1) + ' syl/s',
          minValue: 0, maxValue: 8,
          zones: [{ upTo: 4.5, bg: '#FCA5A5', label: '< 4.5 out of range',  labelColor: '#DC2626' },
                  { upTo: 5.5, bg: '#FDE68A', label: '4.5–5.5 borderline',  labelColor: '#D97706' },
                  { upTo: 8.0, bg: '#A7F3D0', label: '≥ 5.5 in range',      labelColor: '#059669' }],
          referenceText: '≥ 5.5 syl/s in range · 4.5–5.5 borderline · < 4.5 out of range' })}
        ${patakaRV.rhythm_cv != null ? pdfZoneGauge({ label: 'Rhythm consistency (CV)', value: patakaRV.rhythm_cv || 0, displayValue: Number(patakaRV.rhythm_cv || 0).toFixed(3),
          minValue: 0, maxValue: 0.40,
          zones: [{ upTo: 0.15, bg: '#A7F3D0', label: '< 0.15 in range',    labelColor: '#059669' },
                  { upTo: 0.25, bg: '#FDE68A', label: '0.15–0.25',           labelColor: '#D97706' },
                  { upTo: 0.40, bg: '#FCA5A5', label: '> 0.25 out of range', labelColor: '#DC2626' }],
          referenceText: '< 0.15 in range · 0.15–0.25 borderline · > 0.25 out of range' }) : ''}
      </div>`;
    }

    // Reading Passage
    const readingRV = allTestResults?.reading_passage?.rawValues;
    if (readingRV && readingRV.speech_rate_wpm != null) {
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Reading Passage — Connected Speech')}
        ${pdfSpeechPaired(readingRV.speech_rate_wpm, readingRV.pause_ratio ?? 0)}
      </div>`;
    }

    // Spiral Drawing
    const spiralRV = allTestResults?.spiral_drawing?.rawValues;
    const spiralImg = spiralImageDataUrl;
    if ((spiralRV && spiralRV.velocityCV != null) || spiralImg) {
      const compColor = (spiralRV?.completionPct ?? 0) >= 70 ? '#059669' : (spiralRV?.completionPct ?? 0) >= 40 ? '#D97706' : '#DC2626';
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Spiral Drawing — Motor Coordination')}
        ${spiralImg ? `<div style="text-align:center;margin-bottom:16px"><img src="${spiralImg}" style="max-width:280px;border-radius:10px;border:1px solid #E2E8F0" alt="Spiral drawing" /></div>` : ''}
        ${spiralRV?.velocityCV != null ? pdfZoneGauge({ label: 'Velocity CV (motor smoothness)', value: spiralRV.velocityCV || 0, displayValue: Number(spiralRV.velocityCV || 0).toFixed(3),
          minValue: 0, maxValue: 1.0,
          zones: [{ upTo: 0.30, bg: '#A7F3D0', label: '< 0.30 in range',    labelColor: '#059669' },
                  { upTo: 0.40, bg: '#FDE68A', label: '0.30–0.40',           labelColor: '#D97706' },
                  { upTo: 1.00, bg: '#FCA5A5', label: '> 0.40 out of range', labelColor: '#DC2626' }],
          referenceText: '< 0.30 in range · 0.30–0.40 borderline · > 0.40 out of range' }) : ''}
        ${(spiralRV?.completionPct ?? 0) > 0 ? `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px">
            <span>Completion</span><span style="color:${compColor}">${(spiralRV.completionPct).toFixed(0)}%</span>
          </div>
          <div style="height:12px;background:#E5E7EB;border-radius:6px;overflow:hidden">
            <div style="width:${Math.min(100, spiralRV.completionPct).toFixed(1)}%;height:100%;background:${compColor};border-radius:6px"></div>
          </div></div>` : ''}
      </div>`;
    }

    // Reaction Time
    const rtRV = allTestResults?.reaction_time?.rawValues;
    if (rtRV && rtRV.mean_rt_ms != null) {
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Reaction Time — Cognitive Motor Speed')}
        ${pdfZoneGauge({ label: 'Mean reaction time', value: rtRV.mean_rt_ms, displayValue: Number(rtRV.mean_rt_ms).toFixed(0) + ' ms',
          minValue: 0, maxValue: 1000,
          zones: [{ upTo: 380,  bg: '#A7F3D0', label: '< 380ms in range',      labelColor: '#059669' },
                  { upTo: 460,  bg: '#FDE68A', label: '380–460ms',              labelColor: '#D97706' },
                  { upTo: 1000, bg: '#FCA5A5', label: '> 460ms out of range',   labelColor: '#DC2626' }],
          referenceText: '< 380ms in range (65+: < 460ms) · 380–460ms borderline · > 460ms out of range' })}
        ${rtRV.rt_cv != null ? pdfZoneGauge({ label: 'Reaction time variability (CV)', value: rtRV.rt_cv || 0, displayValue: Number(rtRV.rt_cv || 0).toFixed(3),
          minValue: 0, maxValue: 0.50,
          zones: [{ upTo: 0.25, bg: '#A7F3D0', label: '< 0.25 in range',    labelColor: '#059669' },
                  { upTo: 0.35, bg: '#FDE68A', label: '0.25–0.35',           labelColor: '#D97706' },
                  { upTo: 0.50, bg: '#FCA5A5', label: '> 0.35 out of range', labelColor: '#DC2626' }],
          referenceText: '< 0.25 in range · 0.25–0.35 borderline · > 0.35 out of range' }) : ''}
        ${(rtRV.miss_rate_pct != null || rtRV.miss_rate != null) ? pdfZoneGauge({ label: 'Miss rate',
          value: rtRV.miss_rate_pct ?? (rtRV.miss_rate != null ? rtRV.miss_rate * 100 : 0),
          displayValue: Number(rtRV.miss_rate_pct ?? (rtRV.miss_rate != null ? rtRV.miss_rate * 100 : 0)).toFixed(1) + '%',
          minValue: 0, maxValue: 50,
          zones: [{ upTo: 5,  bg: '#A7F3D0', label: '< 5% in range',    labelColor: '#059669' },
                  { upTo: 15, bg: '#FDE68A', label: '5–15%',              labelColor: '#D97706' },
                  { upTo: 50, bg: '#FCA5A5', label: '> 15% out of range', labelColor: '#DC2626' }],
          referenceText: '< 5% in range · 5–15% borderline · > 15% out of range' }) : ''}
      </div>`;
    }

    // Rest Tremor
    const tremorRV = allTestResults?.rest_tremor?.rawValues;
    const tremorPower = tremorRV?.power_ratio_3_7hz ?? tremorRV?.power_ratio ?? null;
    if (tremorPower != null) {
      graphSections += `<div class="graph-card" style="margin-bottom:24px">
        ${pdfSectionHeader('Rest Tremor — Accelerometer Analysis')}
        ${pdfZoneGauge({ label: '3–7 Hz power ratio', value: tremorPower, displayValue: Number(tremorPower * 100).toFixed(1) + '%',
          minValue: 0, maxValue: 0.60,
          zones: [{ upTo: 0.20, bg: '#A7F3D0', label: '< 20% in range',    labelColor: '#059669' },
                  { upTo: 0.40, bg: '#FDE68A', label: '20–40% borderline',  labelColor: '#D97706' },
                  { upTo: 0.60, bg: '#FCA5A5', label: '> 40% out of range', labelColor: '#DC2626' }],
          referenceText: '< 0.20 in range · 0.20–0.40 borderline · > 0.40 out of range' })}
      </div>`;
    }
  }

  const graphSection = graphSections
    ? `<div class="section-title">Measurement summaries</div><div>${graphSections}</div>`
    : '';

  // ── Image section (spiral, standalone at end) ────────────────────────────
  const imagesSection = spiralImageDataUrl && !graphSections.includes(spiralImageDataUrl)
    ? `<div class="section-title">Visual assessment references</div>
       <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:8px">
         <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748B;margin-bottom:6px">Spiral drawing</div>
         <img src="${spiralImageDataUrl}" style="max-width:260px;border-radius:8px;border:1px solid #E2E8F0" /></div>
       </div>`
    : '';

  const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Parkinsoff — Assessment Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #0F172A;
      background: #fff;
      padding: 48px;
      max-width: 760px;
      margin: 0 auto;
      line-height: 1.65;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 20px;
      border-bottom: 2px solid #E2E8F0;
      margin-bottom: 28px;
    }
    .logo-mark {
      width: 40px;
      height: 40px;
      background: #7C6AF7;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .app-name { font-size: 20px; font-weight: 800; color: #0F172A; }
    .report-meta { font-size: 13px; color: #64748B; margin-top: 2px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748B;
      margin: 28px 0 12px;
      padding-top: 20px;
      border-top: 1px solid #E2E8F0;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #F8FAFC;
      color: #64748B;
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 2px solid #E2E8F0;
    }
    tr:last-child td { border-bottom: none; }
    td { border-bottom: 1px solid #F1F5F9; }
    ul { padding-left: 20px; }
    li { font-size: 14px; color: #334155; margin-bottom: 6px; line-height: 1.5; }
    p { font-size: 14px; color: #334155; margin-bottom: 12px; line-height: 1.65; }
    .disclaimer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #FCD34D;
      background: #FFFBEB;
      border-radius: 8px;
      padding: 18px 20px;
    }
    .disclaimer-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #92400E;
      margin-bottom: 8px;
    }
    .disclaimer-text { font-size: 12px; color: #78350F; line-height: 1.65; }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #94A3B8;
      text-align: center;
    }
    .bar-chart { background: #F8FAFC; border-radius: 8px; padding: 14px 16px; }
    @media print {
      body { padding: 24px; font-size: 12px; }
      .section { page-break-inside: avoid; }
      .graph-card { page-break-inside: avoid; }
      img { max-width: 340px; page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- SECTION 1: HEADER -->
  <div class="header">
    <div class="logo-mark">PO</div>
    <div>
      <div class="app-name">Parkinsoff</div>
      <div class="report-meta">Parkinson's Early Awareness Assessment Report</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:13px;font-weight:600;color:#0F172A">${dateStr}</div>
    </div>
  </div>

  <!-- SECTION 2: OVERALL RESULT -->
  ${overallSection}

  <!-- SECTION 3: STRONG TESTS -->
  ${hasNewFlow ? `
  <div class="section-title">Core Indicators — Strong Tests (drive the overall conclusion)</div>
  <table>
    <thead>
      <tr>
        <th>Test</th>
        <th>Status</th>
        <th>Key Metric</th>
      </tr>
    </thead>
    <tbody>${strongRows}</tbody>
  </table>
  ${concordSection}
  ` : ''}

  <!-- SECTION 4: SUPPORTING TESTS -->
  ${hasNewFlow ? `
  <div class="section-title">Supporting Tests (contextual — do not drive the conclusion)</div>
  <table>
    <thead>
      <tr>
        <th>Test</th>
        <th>Status</th>
        <th>Key Metric</th>
      </tr>
    </thead>
    <tbody>${supportRows}</tbody>
  </table>
  ` : ''}

  ${sessionRawSection}

  ${caveatsSection}

  <!-- SECTION 5: GRAPH SUMMARIES -->
  ${graphSection}

  <!-- SECTION 6: HISTORY -->
  ${allAnalyses.length > 0 ? `
  <div class="section-title">Assessment History (last 10)</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Signal Level</th>
        <th>Score</th>
        <th>Signals Detected</th>
      </tr>
    </thead>
    <tbody>${histRows}</tbody>
  </table>
  ` : ''}

  ${imagesSection}

  <!-- SECTION 6: DISCLAIMER & FOOTER -->
  <div class="disclaimer">
    <div class="disclaimer-title">Important Medical Disclaimer</div>
    <div class="disclaimer-text">
      This report is a screening tool for personal awareness only — it is NOT a medical diagnosis,
      clinical assessment, or substitute for professional medical advice.
      If you have concerns about your neurological health, consult a qualified neurologist or
      movement disorder specialist and bring this report to your appointment.
    </div>
  </div>

  <div class="footer">
    Generated by Parkinsoff &mdash; ${todayStr} &mdash; For awareness purposes only. Not a medical diagnosis.
  </div>

</body>
</html>`;

  return openPrintWindow(html);
}
