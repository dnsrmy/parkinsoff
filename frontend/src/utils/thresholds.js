// Thresholds from Parameters.pdf (Little et al. 2008 + MDS-UPDRS references)
// sustained_vowel is handled entirely by the protected voice pipeline (backend/src/routes/voice.js)

export const THRESHOLDS = {
  rest_tremor: {
    power_ratio_3_7hz: {
      in_range:     { max: 0.20 },
      borderline:   { min: 0.20, max: 0.40 },
      out_of_range: { min: 0.40 },
    },
  },

  finger_tapping: {
    mean_intertap_ms: {
      in_range:     { min: 150, max: 250 },
      borderline:   { min: 250, max: 350 },
      out_of_range: { min: 350 },
    },
    interval_cv: {
      in_range:     { max: 0.15 },
      borderline:   { min: 0.15, max: 0.25 },
      out_of_range: { min: 0.25 },
    },
    lr_asymmetry: {
      in_range:     { max: 0.10 },
      borderline:   { min: 0.10, max: 0.15 },
      out_of_range: { min: 0.15 },
    },
  },

  pataka: {
    syllable_rate: {
      in_range:     { min: 5.5 },
      borderline:   { min: 4.5, max: 5.5 },
      out_of_range: { max: 4.5 },
    },
    rhythm_cv: {
      in_range:     { max: 0.15 },
      borderline:   { min: 0.15, max: 0.25 },
      out_of_range: { min: 0.25 },
    },
  },

  reading_passage: {
    speech_rate_wpm: {
      in_range:     [{ min: 130, max: 200 }],
      borderline:   [{ min: 100, max: 130 }, { min: 200, max: 250 }],
      out_of_range: [{ max: 100 }, { min: 250 }],
    },
    pause_ratio: {
      in_range:     { max: 0.25 },
      borderline:   { min: 0.25, max: 0.35 },
      out_of_range: { min: 0.35 },
    },
  },

  spiral_drawing: {
    velocity_cv: {
      in_range:     { max: 0.30 },
      borderline:   { min: 0.30, max: 0.40 },
      out_of_range: { min: 0.40 },
    },
    power_fraction_4_7hz: {
      in_range:     { max: 0.20 },
      borderline:   { min: 0.20, max: 0.35 },
      out_of_range: { min: 0.35 },
    },
  },

  reaction_time: {
    mean_rt_ms: {
      in_range:     { max: 480 },
      borderline:   { min: 480, max: 560 },
      out_of_range: { min: 560 },
    },
    mean_rt_ms_over65: {
      in_range:     { max: 380 },
      borderline:   { min: 380, max: 460 },
      out_of_range: { min: 460 },
    },
    rt_cv: {
      in_range:     { max: 0.25 },
      borderline:   { min: 0.25, max: 0.35 },
      out_of_range: { min: 0.35 },
    },
    miss_rate_pct: {
      in_range:     { max: 5 },
      borderline:   { min: 5, max: 15 },
      out_of_range: { min: 15 },
    },
  },
};

// Strong tests drive the overall conclusion (Resumen.pdf)
// Supporting tests add narrative only — never escalate the overall score
export const TEST_CLASSIFICATION = {
  strong:     ['sustained_vowel', 'rest_tremor', 'finger_tapping'],
  supporting: ['pataka', 'reading_passage', 'spiral_drawing', 'reaction_time'],
};
