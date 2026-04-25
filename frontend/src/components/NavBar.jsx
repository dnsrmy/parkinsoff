import { T, F } from '../design.js';

const SHOW_ON = ['home', 'history', 'upload', 'profile'];

const TABS = [
  {
    label: 'Dashboard',
    screen: 'home',
    activeOn: ['home'],
    opts: {},
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1.5" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
        <rect x="11" y="3" width="6" height="6" rx="1.5" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
        <rect x="3" y="11" width="6" height="6" rx="1.5" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
      </svg>
    ),
  },
  {
    label: 'New Test',
    screen: 'session_questionnaire',
    activeOn: ['test', 'analyzing', 'session_questionnaire'],
    opts: {},
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
        <path d="M10 6.5v7M6.5 10h7" stroke={active ? T.accent : T.muted} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'History',
    screen: 'history',
    activeOn: ['history'],
    opts: {},
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="3" width="12" height="14" rx="2" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
        <path d="M7 8h6M7 11h4" stroke={active ? T.accent : T.muted} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Profile',
    screen: 'profile',
    activeOn: ['profile'],
    opts: {},
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" stroke={active ? T.accent : T.muted} strokeWidth="1.6"/>
        <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke={active ? T.accent : T.muted} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function NavBar({ screen, onNavigate }) {
  if (!SHOW_ON.includes(screen)) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      backgroundColor: T.surface,
      borderTop: `1px solid ${T.border}`,
      display: 'flex',
      zIndex: 900,
      boxShadow: '0 -2px 16px rgba(15,23,42,0.06)',
    }}>
      {TABS.map((tab) => {
        const active = tab.activeOn.includes(screen);
        return (
          <button
            key={tab.screen}
            onClick={() => onNavigate(tab.screen, tab.opts)}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              color: active ? T.accent : T.muted,
              fontSize: F.small,
              fontWeight: active ? 700 : 400,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderTop: `2px solid ${active ? T.accent : 'transparent'}`,
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'color 0.15s',
            }}
          >
            {tab.icon(active)}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
