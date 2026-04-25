import React from 'react'

const NOT_DONE = (
  <p style={{ fontSize: 14, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', padding: '16px 0', margin: 0 }}>
    Test not completed yet
  </p>
)

// zones: [{ end (in measurement units), fill, label, labelColor }]
// The last zone's end value is ignored — it always extends to x2.
// scale: the maximum value for the axis.
function ZoneGaugeSVG({ value, scale, zones, displayValue }) {
  const x1 = 40, x2 = 460, y1 = 42, y2 = 66, w = x2 - x1
  const toX = v => x1 + Math.min(1, Math.max(0, v / scale)) * w
  const mx = toX(value)
  const txMin = x1 + 18, txMax = x2 - 18
  const tx = Math.min(txMax, Math.max(txMin, mx))

  let px = x1
  const rects = zones.map((z, i) => {
    const ex = i < zones.length - 1 ? toX(z.end) : x2
    const rect = <rect key={i} x={px} y={y1} width={Math.max(0, ex - px)} height={y2 - y1} fill={z.fill} />
    px = ex
    return rect
  })

  let lpx = x1
  const lbls = zones.map((z, i) => {
    const lex = i < zones.length - 1 ? toX(z.end) : x2
    const cx = (lpx + lex) / 2
    const lbl = <text key={i} x={cx} y={86} textAnchor="middle" fontSize={10} fill={z.labelColor}>{z.label}</text>
    lpx = lex
    return lbl
  })

  const bounds = zones.slice(0, -1).map((z, i) => {
    const bx = toX(z.end)
    return <line key={i} x1={bx} y1={y1 - 1} x2={bx} y2={y2 + 1} stroke="#D1D5DB" strokeWidth={1} />
  })

  return (
    <svg viewBox="0 0 500 100" style={{ width: '100%', height: 100, display: 'block' }}>
      {rects}
      {bounds}
      <rect x={x1} y={y1} width={w} height={y2 - y1} fill="none" stroke="#E5E7EB" strokeWidth={1} />
      <line x1={mx} y1={y1 - 8} x2={mx} y2={y2 + 6} stroke="#111827" strokeWidth={2.5} />
      <text x={tx} y={y1 - 11} textAnchor="middle" fontSize={12} fontWeight="700" fill="#111827">{displayValue}</text>
      {lbls}
    </svg>
  )
}

function ZoneGauge({ label, value, scale, zones, displayValue, style = {} }) {
  return (
    <div style={{ marginBottom: 4, ...style }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 0 }}>{label}</div>
      <ZoneGaugeSVG value={value} scale={scale} zones={zones} displayValue={displayValue} />
    </div>
  )
}

// ─── Voice ────────────────────────────────────────────────────────────────────

export function VoiceStabilityGraph({ rawValues }) {
  if (!rawValues?.rmsEnergy) return NOT_DONE
  const { rmsEnergy, energyVariance, silenceRatio } = rawValues

  return (
    <div style={{ padding: '4px 0' }}>
      <ZoneGauge
        label="RMS Energy"
        value={rmsEnergy ?? 0}
        scale={0.20}
        displayValue={(rmsEnergy ?? 0).toFixed(4)}
        zones={[
          { end: 0.01,  fill: '#FCA5A5', label: '< 0.01',          labelColor: '#DC2626' },
          { end: 0.04,  fill: '#FDE68A', label: '0.01 – 0.04',     labelColor: '#D97706' },
          { end: 0.20,  fill: '#A7F3D0', label: '≥ 0.04 in range', labelColor: '#059669' },
        ]}
      />
      {(silenceRatio ?? 0) >= 0 && (
        <ZoneGauge
          label="Silence Ratio"
          value={silenceRatio ?? 0}
          scale={1.0}
          displayValue={((silenceRatio ?? 0) * 100).toFixed(1) + '%'}
          zones={[
            { end: 0.40, fill: '#A7F3D0', label: '< 40% in range', labelColor: '#059669' },
            { end: 0.65, fill: '#FDE68A', label: '40 – 65%',       labelColor: '#D97706' },
            { end: 1.0,  fill: '#FCA5A5', label: '> 65%',          labelColor: '#DC2626' },
          ]}
        />
      )}
      {(energyVariance ?? 0) > 0 && (
        <ZoneGauge
          label="Energy Variance"
          value={energyVariance ?? 0}
          scale={0.015}
          displayValue={(energyVariance ?? 0).toFixed(5)}
          zones={[
            { end: 0.002, fill: '#A7F3D0', label: '< 0.002 in range', labelColor: '#059669' },
            { end: 0.008, fill: '#FDE68A', label: '0.002 – 0.008',    labelColor: '#D97706' },
            { end: 0.015, fill: '#FCA5A5', label: '> 0.008',          labelColor: '#DC2626' },
          ]}
        />
      )}
    </div>
  )
}

// ─── Pa-Ta-Ka ─────────────────────────────────────────────────────────────────

export function SyllableRateGraph({ rawValues }) {
  if (!rawValues?.syllable_rate) return NOT_DONE
  const { syllable_rate: rate, rhythm_cv } = rawValues

  return (
    <div style={{ padding: '4px 0' }}>
      <ZoneGauge
        label="Syllable Rate"
        value={rate}
        scale={8}
        displayValue={rate.toFixed(1) + ' syl/s'}
        zones={[
          { end: 4.5, fill: '#FCA5A5', label: '< 4.5 out of range',   labelColor: '#DC2626' },
          { end: 5.5, fill: '#FDE68A', label: '4.5 – 5.5 borderline', labelColor: '#D97706' },
          { end: 8,   fill: '#A7F3D0', label: '≥ 5.5 in range',       labelColor: '#059669' },
        ]}
      />
      {rhythm_cv != null && (
        <ZoneGauge
          label="Rhythm CV"
          value={rhythm_cv}
          scale={0.40}
          displayValue={rhythm_cv.toFixed(3)}
          zones={[
            { end: 0.15, fill: '#A7F3D0', label: '< 0.15 in range', labelColor: '#059669' },
            { end: 0.25, fill: '#FDE68A', label: '0.15 – 0.25',     labelColor: '#D97706' },
            { end: 0.40, fill: '#FCA5A5', label: '> 0.25',          labelColor: '#DC2626' },
          ]}
        />
      )}
    </div>
  )
}

// ─── Reading Passage ──────────────────────────────────────────────────────────

export function SpeechRateGraph({ rawValues }) {
  if (!rawValues?.speech_rate_wpm) return NOT_DONE
  const wpm = rawValues.speech_rate_wpm ?? 0
  const pauseRatio = rawValues.pause_ratio ?? 0

  const prColor = pauseRatio < 0.25 ? '#059669' : pauseRatio < 0.35 ? '#D97706' : '#DC2626'
  const prFillPct = Math.min(100, pauseRatio * 100)

  return (
    <div style={{ padding: '4px 0', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 3 }}>
        <ZoneGauge
          label="Speech Rate"
          value={wpm}
          scale={300}
          displayValue={wpm.toFixed(0) + ' wpm'}
          zones={[
            { end: 100, fill: '#FCA5A5', label: '< 100',            labelColor: '#DC2626' },
            { end: 130, fill: '#FDE68A', label: '100 – 130',        labelColor: '#D97706' },
            { end: 200, fill: '#A7F3D0', label: '130–200 in range', labelColor: '#059669' },
            { end: 250, fill: '#FDE68A', label: '200 – 250',        labelColor: '#D97706' },
            { end: 300, fill: '#FCA5A5', label: '> 250',            labelColor: '#DC2626' },
          ]}
        />
      </div>
      <div style={{ flex: 1, textAlign: 'center', paddingTop: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Pause Ratio</div>
        <div style={{
          display: 'inline-block', position: 'relative',
          width: 36, height: 72, background: '#E5E7EB', borderRadius: 6, overflow: 'hidden', verticalAlign: 'top',
        }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: prColor, height: `${prFillPct}%` }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: prColor, marginTop: 4 }}>
          {(pauseRatio * 100).toFixed(1)}%
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{'<25% in range'}</div>
      </div>
    </div>
  )
}

// ─── Finger Tapping ───────────────────────────────────────────────────────────

export function TappingIntervalGraph({ rawValues }) {
  if (!rawValues?.mean_intertap_ms) return NOT_DONE
  const {
    mean_intertap_ms, mean_intertap_ms_nondominant,
    dominantIntervals, nondominantIntervals, interval_cv,
  } = rawValues

  const W = 520, chartX1 = 40, chartX2 = 490, chartY1 = 20, chartY2 = 120
  const yPos = ms => chartY2 - (Math.min(ms, 400) / 400) * (chartY2 - chartY1)
  const yRef = yPos(250)

  const hasDom = Array.isArray(dominantIntervals) && dominantIntervals.length > 0
  const hasNon = Array.isArray(nondominantIntervals) && nondominantIntervals.length > 0

  const dotEls = []
  if (hasDom) {
    const n = dominantIntervals.length
    dominantIntervals.forEach((ms, i) => {
      dotEls.push(
        <circle key={`d${i}`} cx={40 + (i / Math.max(n - 1, 1)) * 225} cy={yPos(ms)} r={5} fill="#3B82F6" opacity={0.85} />
      )
    })
  }
  if (hasNon) {
    const n = nondominantIntervals.length
    nondominantIntervals.forEach((ms, i) => {
      dotEls.push(
        <circle key={`n${i}`} cx={265 + (i / Math.max(n - 1, 1)) * 225} cy={yPos(ms)} r={5} fill="#0D9488" opacity={0.85} />
      )
    })
  }
  if (!hasDom && !hasNon) {
    dotEls.push(
      <circle key="dm" cx={155} cy={yPos(mean_intertap_ms)} r={8} fill="#3B82F6" opacity={0.85} />,
      <text key="dml" x={155} y={chartY2 + 16} textAnchor="middle" fontSize={11} fill="#6B7280">
        {`Dom: ${mean_intertap_ms?.toFixed(0)}ms`}
      </text>,
    )
    if (mean_intertap_ms_nondominant != null) {
      dotEls.push(
        <circle key="nm" cx={355} cy={yPos(mean_intertap_ms_nondominant)} r={8} fill="#0D9488" opacity={0.85} />,
        <text key="nml" x={355} y={chartY2 + 16} textAnchor="middle" fontSize={11} fill="#6B7280">
          {`Non-dom: ${mean_intertap_ms_nondominant?.toFixed(0)}ms`}
        </text>,
      )
    }
  }

  const yAxisLabels = [0, 100, 200, 300, 400].map(ms => (
    <text key={ms} x={35} y={yPos(ms) + 4} textAnchor="end" fontSize={10} fill="#94A3B8">{ms}</text>
  ))

  const hasNonDom = hasNon || mean_intertap_ms_nondominant != null

  return (
    <div style={{ padding: '4px 0' }}>
      <svg viewBox={`0 0 ${W} 160`} style={{ width: '100%', height: 160, display: 'block' }}>
        <line x1={chartX1} y1={chartY1} x2={chartX1} y2={chartY2} stroke="#E5E7EB" strokeWidth={1} />
        {yAxisLabels}
        <line x1={chartX1} y1={yRef} x2={chartX2} y2={yRef}
              stroke="#D97706" strokeWidth={1.5} strokeDasharray="5 3" />
        <text x={chartX2 + 5} y={yRef + 4} fontSize={11} fill="#D97706">250ms</text>
        {dotEls}
        <circle cx={50} cy={148} r={5} fill="#3B82F6" />
        <text x={60} y={152} fontSize={11} fill="#6B7280">Dominant hand</text>
        {hasNonDom && (
          <>
            <circle cx={170} cy={148} r={5} fill="#0D9488" />
            <text x={180} y={152} fontSize={11} fill="#6B7280">Non-dominant hand</text>
          </>
        )}
      </svg>
      {interval_cv != null && (
        <ZoneGauge
          label="Interval CV (variability)"
          value={interval_cv}
          scale={0.5}
          displayValue={interval_cv.toFixed(3)}
          zones={[
            { end: 0.15, fill: '#A7F3D0', label: '< 0.15 in range', labelColor: '#059669' },
            { end: 0.25, fill: '#FDE68A', label: '0.15 – 0.25',     labelColor: '#D97706' },
            { end: 0.50, fill: '#FCA5A5', label: '> 0.25',          labelColor: '#DC2626' },
          ]}
        />
      )}
    </div>
  )
}

// ─── Spiral Drawing ───────────────────────────────────────────────────────────

export function SpiralDeviationGraph({ rawValues, spiralImageDataUrl }) {
  if (!rawValues?.completionPct && !rawValues?.irregularity && !rawValues?.velocityCV && !spiralImageDataUrl) {
    return NOT_DONE
  }

  const velocityCV = rawValues?.velocityCV ?? null
  const completion = rawValues?.completionPct ?? 0
  const compColor = completion >= 70 ? '#059669' : completion >= 40 ? '#D97706' : '#DC2626'

  return (
    <div style={{ padding: '4px 0' }}>
      {spiralImageDataUrl && (
        <img
          src={spiralImageDataUrl}
          alt="Spiral drawing"
          style={{
            width: '100%', maxWidth: 300, display: 'block',
            margin: '0 auto 16px', borderRadius: 12, border: '1px solid #E2E8F0',
          }}
        />
      )}
      {velocityCV != null && (
        <ZoneGauge
          label="Velocity CV (motor smoothness)"
          value={velocityCV}
          scale={1.0}
          displayValue={velocityCV.toFixed(3)}
          zones={[
            { end: 0.30, fill: '#A7F3D0', label: '< 0.30 in range',        labelColor: '#059669' },
            { end: 0.40, fill: '#FDE68A', label: '0.30 – 0.40 borderline', labelColor: '#D97706' },
            { end: 1.0,  fill: '#FCA5A5', label: '> 0.40 out of range',    labelColor: '#DC2626' },
          ]}
        />
      )}
      {completion > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>Completion</span>
            <span style={{ fontWeight: 700, color: compColor }}>{completion.toFixed(0)}%</span>
          </div>
          <div style={{ height: 10, background: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, completion)}%`, height: '100%', background: compColor, borderRadius: 5 }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reaction Time ────────────────────────────────────────────────────────────

export function ReactionTimeHistogram({ rawValues }) {
  if (!rawValues?.mean_rt_ms) return NOT_DONE
  const { mean_rt_ms, rt_cv, miss_rate } = rawValues

  return (
    <div style={{ padding: '4px 0' }}>
      <ZoneGauge
        label="Mean Reaction Time"
        value={mean_rt_ms}
        scale={1000}
        displayValue={mean_rt_ms.toFixed(0) + ' ms'}
        zones={[
          { end: 380,  fill: '#A7F3D0', label: '< 380ms in range', labelColor: '#059669' },
          { end: 460,  fill: '#FDE68A', label: '380 – 460ms',      labelColor: '#D97706' },
          { end: 1000, fill: '#FCA5A5', label: '> 460ms',          labelColor: '#DC2626' },
        ]}
      />
      {rt_cv != null && (
        <ZoneGauge
          label="Reaction Time CV"
          value={rt_cv}
          scale={0.5}
          displayValue={rt_cv.toFixed(3)}
          zones={[
            { end: 0.25, fill: '#A7F3D0', label: '< 0.25 in range', labelColor: '#059669' },
            { end: 0.35, fill: '#FDE68A', label: '0.25 – 0.35',     labelColor: '#D97706' },
            { end: 0.50, fill: '#FCA5A5', label: '> 0.35',          labelColor: '#DC2626' },
          ]}
        />
      )}
      {miss_rate != null && (
        <ZoneGauge
          label="Miss Rate"
          value={miss_rate}
          scale={0.5}
          displayValue={(miss_rate * 100).toFixed(1) + '%'}
          zones={[
            { end: 0.10, fill: '#A7F3D0', label: '< 10% in range', labelColor: '#059669' },
            { end: 0.20, fill: '#FDE68A', label: '10 – 20%',       labelColor: '#D97706' },
            { end: 0.50, fill: '#FCA5A5', label: '> 20%',          labelColor: '#DC2626' },
          ]}
        />
      )}
    </div>
  )
}

// ─── Rest Tremor ──────────────────────────────────────────────────────────────

export function TremorPowerGraph({ rawValues }) {
  if (!rawValues?.power_ratio_3_7hz && !rawValues?.power_ratio) return NOT_DONE
  const powerRatio = rawValues.power_ratio_3_7hz ?? rawValues.power_ratio ?? 0

  return (
    <div style={{ padding: '4px 0' }}>
      <ZoneGauge
        label="3–7 Hz Power Ratio"
        value={powerRatio}
        scale={0.60}
        displayValue={(powerRatio * 100).toFixed(1) + '%'}
        zones={[
          { end: 0.20, fill: '#A7F3D0', label: '< 20% in range',      labelColor: '#059669' },
          { end: 0.40, fill: '#FDE68A', label: '20 – 40% borderline',  labelColor: '#D97706' },
          { end: 0.60, fill: '#FCA5A5', label: '> 40% out of range',   labelColor: '#DC2626' },
        ]}
      />
    </div>
  )
}
