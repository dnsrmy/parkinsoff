import { useState } from 'react';
import { getAnalyses, getSignalHistory, getXp } from '../utils/storage.js';
import { exportToPdf } from '../utils/exportPdf.js';

const SEV_LABELS = {
  watch:  'Notable signals — see a doctor',
  medium: 'Moderate signals — monitor',
  low:    'Low signals',
  none:   'No signals',
};

const SEV_COLOR = {
  watch:  '#991B1B',
  medium: '#92400E',
  low:    '#065F46',
  none:   '#64748B',
};

const FILTERS = [
  { key: 'All',      label: 'All' },
  { key: 'watch',    label: 'Notable' },
  { key: 'medium',   label: 'Moderate' },
  { key: 'low',      label: 'Low' },
];

function fmtMonthDay(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

function fmtYear(iso) {
  if (!iso) return '';
  try { return new Date(iso).getFullYear().toString(); }
  catch { return ''; }
}

function fmtToday() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen({ onBack, onExport }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const allAnalyses = getAnalyses();

  const filtered = activeFilter === 'All'
    ? allAnalyses
    : allAnalyses.filter(a => (a.severityLevel || '') === activeFilter);

  function handleExport(analysis) {
    onExport(analysis);
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#E8EAF6', fontFamily: 'system-ui, sans-serif', paddingBottom: 64 }}>

      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E8E0FF', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>Assessment History</div>
        </div>
        <div style={{ fontSize: 13, color: '#9E9EB0', marginBottom: 12 }}>{fmtToday()}</div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                backgroundColor: activeFilter === f.key ? '#7C6AF7' : '#EDE9FF',
                color: activeFilter === f.key ? '#fff' : '#7C6AF7',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            backgroundColor: '#fff', borderRadius: 16, border: '1px solid #E8E0FF',
          }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>
              No assessments yet
            </div>
            <div style={{ fontSize: 14, color: '#9E9EB0' }}>
              {activeFilter === 'All'
                ? 'Complete your first assessment to see results here.'
                : `No assessments with "${FILTERS.find(f => f.key === activeFilter)?.label}" signal level.`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(a => {
              const sevColor = SEV_COLOR[a.severityLevel] || '#64748B';
              const sevLabel = SEV_LABELS[a.severityLevel] || a.severityLevel || 'Unknown';
              return (
                <div
                  key={a.id}
                  style={{
                    backgroundColor: '#fff', borderRadius: 14,
                    border: '1px solid #E8E0FF', padding: 20,
                    boxShadow: '0 2px 8px rgba(26,26,46,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', lineHeight: 1 }}>
                        {fmtMonthDay(a.date)}
                      </div>
                      <div style={{ fontSize: 12, color: '#9E9EB0', marginTop: 2 }}>{fmtYear(a.date)}</div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: sevColor,
                      backgroundColor: sevColor + '18', padding: '4px 12px',
                      borderRadius: 100, border: `1px solid ${sevColor}33`,
                    }}>
                      {sevLabel}
                    </span>
                  </div>

                  {a.detectedSignals?.length > 0 && (
                    <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
                      {a.detectedSignals.map(s => s.replace(/_/g, ' ')).join(', ')}
                    </div>
                  )}

                  <button
                    onClick={() => handleExport(a)}
                    style={{
                      background: 'none', border: '1px solid #D4D0F0',
                      borderRadius: 8, padding: '8px 16px',
                      fontSize: 13, fontWeight: 600, color: '#7C6AF7',
                      cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    Export report
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}