// Shared design tokens — Parkinsoff lavender/purple theme
export const T = {
  bg:           '#E8EAF6',
  surface:      '#FFFFFF',
  surface2:     '#EDE9FF',
  border:       '#D4D0F0',
  shadow:       '0 2px 12px rgba(26,26,46,0.08)',
  shadowMd:     '0 6px 24px rgba(26,26,46,0.12)',
  shadowLg:     '0 12px 40px rgba(26,26,46,0.16)',
  accent:       '#7C6AF7',
  accentBg:     '#EDE9FF',
  accentDark:   '#6B5CE7',
  accentLight:  '#A89CF7',
  brand:        '#7C6AF7',
  brandBg:      '#EDE9FF',
  brandBorder:  '#C4B5FD',
  brandDark:    '#6B5CE7',
  text:         '#1A1A2E',
  textSec:      '#3D3D5C',
  muted:        '#9E9EB0',
  faint:        '#D4D0F0',
  green:        '#2D6A4F',
  greenBg:      '#D8F3DC',
  greenBorder:  '#95D5A7',
  successBg:    '#7DC95E',
  amber:        '#92400E',
  amberBg:      '#FFFBEB',
  amberBorder:  '#FCD34D',
  red:          '#991B1B',
  redBg:        '#FFF1F2',
  redBorder:    '#FECACA',
  blue:         '#5B9FE0',
  teal:         '#4BC6B9',
};

export const F = {
  display: 36, h1: 28, h2: 22, h3: 18, body: 17, label: 16, caption: 14, small: 13,
};

export const btnPrimary = (disabled) => ({
  backgroundColor: disabled ? T.faint : T.accent,
  color: disabled ? T.muted : '#fff',
  border: 'none',
  borderRadius: 28,
  height: 54,
  fontSize: F.label,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  transition: 'transform 0.1s ease, box-shadow 0.15s ease',
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(124,106,247,0.30)',
});

export const btnSecondary = (accent = T.accent) => ({
  backgroundColor: T.surface,
  color: accent,
  border: `1.5px solid ${accent}`,
  borderRadius: 28,
  height: 50,
  fontSize: F.label,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  transition: 'background-color 0.15s ease',
});

export const btnGhost = {
  backgroundColor: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 20,
  height: 48,
  fontSize: F.caption,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'border-color 0.15s ease, color 0.15s ease',
};

export const card = {
  backgroundColor: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 24,
  boxShadow: T.shadow,
};

export const animStyle = (visible, delay = 0) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateY(16px)',
  transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
});

// Reusable redo button style
export const redoBtn = (active) => ({
  width: 52,
  height: 54,
  borderRadius: 16,
  backgroundColor: active ? T.accent : '#9E9E9E',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

// Tab categories for test screens
export const TEST_TAB_CATEGORIES = [
  { label: 'SYMPTOMS', tests: ['symptoms'] },
  { label: 'VOICE',    tests: ['sustained_vowel', 'pataka', 'reading_passage'] },
  { label: 'MOTOR',    tests: ['finger_tapping', 'spiral_drawing'] },
  { label: 'COGNITIVE',tests: ['reaction_time'] },
  { label: 'TREMORS',  tests: ['rest_tremor'] },
];
