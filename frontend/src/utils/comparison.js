// Compares legacy testBreakdown values to published reference ranges.
// Only used in the old (non-clinical) flow.

const BASELINES = {
  voice: {
    label: 'Phonation Duration',
    referenceRange: '≥ 10 seconds (Baken & Orlikoff 2000)',
    getValue: (t) => t?.phonationTime ?? null,
    getStatus: (v) => v == null ? null : v >= 10 ? 'in_range' : v >= 7 ? 'borderline' : 'out_of_range',
    formatValue: (v) => `${v?.toFixed(1)}s`,
    getPercent: (v) => v == null ? 0 : Math.min(100, (v / 15) * 100),
  },
  spiral: {
    label: 'Spiral Irregularity',
    referenceRange: 'Irregularity < 20% (Pullman 1998)',
    getValue: (t) => t?.irregularity ?? null,
    getStatus: (v) => v == null ? null : v < 0.20 ? 'in_range' : v < 0.40 ? 'borderline' : 'out_of_range',
    formatValue: (v) => `${(v * 100).toFixed(0)}%`,
    getPercent: (v) => v == null ? 0 : Math.min(100, v * 200),
  },
  tap: {
    label: 'Finger Tapping Rate',
    referenceRange: '≥ 3.5 taps/s (MDS-UPDRS III)',
    getValue: (t) => t?.ratePerSecond ?? null,
    getStatus: (v) => v == null ? null : v >= 3.5 ? 'in_range' : v >= 2.5 ? 'borderline' : 'out_of_range',
    formatValue: (v) => `${v?.toFixed(1)} taps/s`,
    getPercent: (v) => v == null ? 0 : Math.min(100, (v / 5) * 100),
  },
};

const STATUS_COLOR = {
  in_range:    '#059669',
  borderline:  '#D97706',
  out_of_range:'#DC2626',
};

const STATUS_LABEL = {
  in_range:    'Within range',
  borderline:  'Worth monitoring',
  out_of_range:'Outside range',
};

export function compareToBaseline(testBreakdown) {
  if (!testBreakdown) return [];
  return Object.entries(BASELINES).flatMap(([key, meta]) => {
    const testData = testBreakdown[key];
    const value = meta.getValue(testData);
    if (value == null) return [];
    const status = meta.getStatus(value);
    if (!status) return [];
    return [{
      key,
      label: meta.label,
      yourValue: meta.formatValue(value),
      percent: meta.getPercent(value),
      color: STATUS_COLOR[status] || '#94A3B8',
      statusLabel: STATUS_LABEL[status] || status,
      referenceRange: meta.referenceRange,
      interpretation: null,
    }];
  });
}
