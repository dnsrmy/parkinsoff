import { useState } from 'react';
import { getAnalyses, getSignalHistory, getXp } from '../utils/storage.js';
import { T, F, btnPrimary } from '../design.js';
import { openPrintWindow, exportToPdf } from '../utils/exportPdf.js';
import DisclaimerBlock from '../components/DisclaimerBlock.jsx';

const btnBase = (bg, color = '#fff') => ({
  backgroundColor: bg,
  color,
  border: 'none',
  borderRadius: 12,
  padding: '0 24px',
  height: 56,
  fontSize: 17,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
});

const SEV_LABEL = {
  watch:  'Notable signal level',
  medium: 'Moderate signal level',
  low:    'Low signal level',
  none:   'No signals detected',
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
}

function formatDateShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

function buildReportHTML(target, userName) {
  const sevLabel = SEV_LABEL[target.severityLevel] || target.severityLevel || 'Unknown';
  const signals = (target.detectedSignals || []).map(s => s.replace(/_/g, ' ')).join(', ') || 'None detected';
  const disclaimer = `This report is for awareness purposes only and does not constitute a medical diagnosis.
    It is not a substitute for professional medical advice. If you have concerns about your neurological health,
    please consult a qualified neurologist or movement disorder specialist.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Parkinson's Awareness Assessment Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1a2e;
      background: #fff;
      padding: 48px;
      max-width: 720px;
      margin: 0 auto;
      line-height: 1.7;
    }
    .header {
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .org-name {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #7c3aed;
      text-transform: uppercase;
      margin-bottom: 10px;
      font-family: system-ui, sans-serif;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .meta {
      font-size: 14px;
      color: #555;
      font-family: system-ui, sans-serif;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #7c3aed;
      margin-bottom: 12px;
      font-family: system-ui, sans-serif;
    }
    .severity-box {
      padding: 20px 24px;
      border-radius: 8px;
      border: 2px solid #7c3aed;
      background: #f5f0ff;
      margin-bottom: 28px;
    }
    .severity-label {
      font-size: 20px;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 6px;
    }
    p {
      font-size: 15px;
      color: #333;
      line-height: 1.75;
      margin-bottom: 12px;
    }
    .signals-list {
      font-family: system-ui, sans-serif;
      font-size: 14px;
      color: #444;
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 14px 18px;
    }
    .action-box {
      border-left: 4px solid #7c3aed;
      padding: 16px 20px;
      background: #f5f0ff;
      border-radius: 0 8px 8px 0;
      margin-bottom: 16px;
    }
    .exercise-box {
      border-left: 4px solid #10b981;
      padding: 16px 20px;
      background: #f0fdf8;
      border-radius: 0 8px 8px 0;
      margin-bottom: 16px;
    }
    .disclaimer-box {
      border: 2px solid #e8b800;
      background: #fffbeb;
      border-radius: 8px;
      padding: 20px 24px;
      margin-top: 36px;
    }
    .disclaimer-title {
      font-weight: 700;
      color: #92400e;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      font-family: system-ui, sans-serif;
    }
    .disclaimer-text {
      font-size: 13px;
      color: #78350f;
      line-height: 1.7;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
      font-family: system-ui, sans-serif;
      text-align: center;
    }
    @media print {
      body { padding: 32px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-name">Parkinsoff</div>
    <h1>Awareness Assessment Report</h1>
    <div class="meta">
      Patient: <strong>${userName || 'Not provided'}</strong> &nbsp;|&nbsp;
      Assessment date: <strong>${formatDate(target.date)}</strong>
    </div>
  </div>

  <div class="severity-box">
    <div class="severity-label">${sevLabel}</div>
    <div style="font-family: system-ui, sans-serif; font-size: 14px; color: #555;">
      Severity level: ${target.severityLevel || 'unknown'}
    </div>
  </div>

  ${target.explanation ? `
  <div class="section">
    <div class="section-title">Assessment Interpretation</div>
    <p>${target.explanation}</p>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Signals Detected</div>
    <div class="signals-list">${signals}</div>
  </div>

  ${target.preventiveShortcut ? `
  <div class="section">
    <div class="section-title">Recommended Action</div>
    <div class="action-box">
      <p style="margin: 0;">${target.preventiveShortcut}</p>
    </div>
  </div>
  ` : ''}

  ${target.exerciseRecommendation ? `
  <div class="section">
    <div class="section-title">Exercise Recommendation</div>
    <div class="exercise-box">
      <p style="margin: 0;">${target.exerciseRecommendation}</p>
    </div>
  </div>
  ` : ''}

  <div class="disclaimer-box">
    <div class="disclaimer-title">Important Medical Disclaimer</div>
    <div class="disclaimer-text">
      ${target.disclaimer || disclaimer}
    </div>
  </div>

  <div class="footer">
    Generated by Parkinsoff &mdash; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    &mdash; For awareness purposes only. Not a medical diagnosis.
  </div>
</body>
</html>`;
}

function buildAllHistoryHTML(userName) {
  const analyses = getAnalyses();
  const rows = analyses.map((a) => {
    const sevLabel = SEV_LABEL[a.severityLevel] || a.severityLevel || 'unknown';
    const signals = (a.detectedSignals || []).map(s => s.replace(/_/g, ' ')).join(', ') || 'None';
    return `
    <tr>
      <td>${formatDateShort(a.date)}</td>
      <td><strong>${sevLabel}</strong></td>
      <td>${signals}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Full Assessment History — Parkinsoff</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1a1a2e; padding: 48px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { font-size: 14px; color: #666; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f5f0ff; color: #7c3aed; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 12px 16px; text-align: left; border-bottom: 2px solid #7c3aed; }
    td { padding: 12px 16px; border-bottom: 1px solid #e8e8e8; vertical-align: top; color: #333; }
    tr:nth-child(even) td { background: #fafafa; }
    .disclaimer { margin-top: 32px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 16px; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <h1>Full Assessment History</h1>
  <div class="meta">Patient: <strong>${userName || 'Not provided'}</strong> &nbsp;|&nbsp; Total assessments: <strong>${analyses.length}</strong> &nbsp;|&nbsp; Exported: ${new Date().toLocaleDateString()}</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Result</th>
        <th>Signals Detected</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="disclaimer">
    This report is for awareness purposes only and does not constitute a medical diagnosis.
    Consult a qualified neurologist for any clinical concerns.
    Generated by Parkinsoff.
  </div>
</body>
</html>`;
}

function buildClipboardSummary(target) {
  if (target) {
    return [
      'PARKINSON\'S SHORTCUT — ASSESSMENT REPORT',
      `Date: ${formatDate(target.date)}`,
      `Result: ${SEV_LABEL[target.severityLevel] || target.severityLevel || 'unknown'}`,
      `Signals detected: ${(target.detectedSignals || []).join(', ') || 'none'}`,
      '',
      target.explanation ? `Interpretation: ${target.explanation}` : '',
      target.preventiveShortcut ? `Recommended action: ${target.preventiveShortcut}` : '',
      '',
      'DISCLAIMER: This is not a medical diagnosis. Consult a qualified neurologist.',
    ].filter(Boolean).join('\n');
  }
  const analyses = getAnalyses();
  const lines = ['PARKINSON\'S SHORTCUT — FULL HISTORY', ''];
  analyses.forEach((a) => {
    lines.push(`${formatDateShort(a.date)} | ${SEV_LABEL[a.severityLevel] || 'unknown'} | Signals: ${(a.detectedSignals || []).join(', ') || 'none'}`);
  });
  lines.push('', 'DISCLAIMER: This is not a medical diagnosis. Consult a neurologist.');
  return lines.join('\n');
}

const OPTIONS = [
  {
    id: 'pdf',
    title: 'Download as PDF',
    subtitle: 'Opens a print dialog to save a PDF to your device',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 14V4M11 4L8 7M11 4l3 3" stroke={T.accentLight} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 16v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke={T.accentLight} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'email',
    title: 'Send by email',
    subtitle: 'Opens your email app with the summary pre-filled',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="5" width="16" height="13" rx="2" stroke={T.accentLight} strokeWidth="1.8"/>
        <path d="M3 8l8 5 8-5" stroke={T.accentLight} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'clipboard',
    title: 'Copy summary',
    subtitle: 'Copies a plain-text summary to your clipboard',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="8" y="3" width="10" height="13" rx="2" stroke={T.accentLight} strokeWidth="1.8"/>
        <path d="M6 6H5a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-1" stroke={T.accentLight} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'history',
    title: 'Export all history',
    subtitle: 'Opens a printable summary of all your assessments',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="4" width="16" height="15" rx="2" stroke={T.accentLight} strokeWidth="1.8"/>
        <path d="M7 9h8M7 13h5M7 17h3" stroke={T.accentLight} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function ExportScreen({ target, onDone, userName }) {
  const [active, setActive] = useState(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  function handleAction(optId) {
    const id = optId || active;
    if (!id) return;

    if (id === 'pdf') {
      if (!target) {
        const allAnalyses = getAnalyses();
        if (allAnalyses.length === 0) {
          alert('No assessments to export yet.');
          return;
        }
        openPrintWindow(buildAllHistoryHTML(userName));
        return;
      }
      const cd = target?._clinicalData;
      exportToPdf({
        allTestResults: cd?.allTestResults ?? {},
        sessionAnswers: cd?.sessionAnswers ?? null,
        profileAnswers: cd?.profileAnswers ?? null,
        allAnalyses: getAnalyses(),
      });

    } else if (id === 'email') {
      const summary = buildClipboardSummary(target);
      const subject = encodeURIComponent("Parkinson's Awareness Assessment Report");
      const body = encodeURIComponent(summary);
      const recipient = email.includes('@') ? email : '';
      const mailto = `mailto:${recipient}?subject=${subject}&body=${body}`;
      window.location.href = mailto;

    } else if (id === 'clipboard') {
      const text = buildClipboardSummary(target);
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }).catch(() => {
        alert('Could not copy to clipboard. Please try copying manually.');
      });

    } else if (id === 'history') {
      const allAnalyses = getAnalyses();
      if (allAnalyses.length === 0) {
        alert('No assessments recorded yet.');
        return;
      }
      openPrintWindow(buildAllHistoryHTML(userName));
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: T.bg,
      fontFamily: 'system-ui, sans-serif',
      paddingBottom: 56,
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${T.border}`,
        padding: '24px 24px 20px',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onDone}
            style={{
              background: 'none',
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              cursor: 'pointer',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontFamily: 'system-ui, sans-serif',
            }}
            aria-label="Go back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: F.h2, fontWeight: 700, color: T.text }}>
              Export Report
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: F.caption, color: T.muted }}>
              {target
                ? `Assessment from ${formatDateShort(target.date)}`
                : 'All assessments'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px' }}>

        {/* Option cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {OPTIONS.map((opt) => {
            const isActive = active === opt.id;
            return (
              <div key={opt.id}>
                <div
                  onClick={() => { setActive(opt.id); setCopied(false); setEmailError(''); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActive(opt.id)}
                  style={{
                    backgroundColor: isActive ? T.surface2 : T.surface,
                    border: `1.5px solid ${isActive ? T.accent : T.border}`,
                    borderRadius: 14,
                    padding: '18px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  {/* Radio indicator */}
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `2px solid ${isActive ? T.accent : T.faint}`,
                    backgroundColor: isActive ? T.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {isActive && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#fff' }} />}
                  </div>

                  {/* Icon */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: T.accent + '18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {opt.icon}
                  </div>

                  <div>
                    <div style={{ fontSize: F.label, fontWeight: 700, color: T.text }}>{opt.title}</div>
                    <div style={{ fontSize: F.caption, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{opt.subtitle}</div>
                  </div>
                </div>

                {/* Expanded content for email */}
                {isActive && opt.id === 'email' && (
                  <div style={{ padding: '14px 20px 0' }}>
                    <label style={{ display: 'block', fontSize: F.label, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>
                      Recipient email (optional)
                    </label>
                    <input
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                      placeholder="doctor@hospital.com"
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: T.surface2,
                        color: T.text,
                        border: `2px solid ${emailFocused ? T.accentLight : emailError ? T.red : T.border}`,
                        borderRadius: 12,
                        padding: '12px 16px',
                        fontSize: F.label,
                        outline: 'none',
                        fontFamily: 'system-ui, sans-serif',
                        height: 52,
                      }}
                    />
                    {emailError && (
                      <p style={{ margin: '6px 0 0', fontSize: F.caption, color: T.red }}>{emailError}</p>
                    )}
                  </div>
                )}

                {/* Clipboard success */}
                {isActive && opt.id === 'clipboard' && copied && (
                  <div style={{
                    padding: '12px 20px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: T.green,
                    fontSize: F.label,
                    fontWeight: 600,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M3 9l4 4 8-8" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Copied to clipboard
                  </div>
                )}

                {/* Action button when selected */}
                {isActive && (
                  <div style={{ padding: '14px 20px 0' }}>
                    <button
                      onClick={() => handleAction(opt.id)}
                      style={{
                        backgroundColor: T.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '0 24px',
                        height: 52,
                        fontSize: F.label,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'system-ui, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {opt.id === 'pdf' ? 'Open print dialog' : opt.id === 'email' ? 'Open email app' : opt.id === 'clipboard' ? 'Copy to clipboard' : 'Export all history'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div style={{ marginBottom: 28 }}>
          <DisclaimerBlock screen="export" />
        </div>

        {/* Back button */}
        <button
          onClick={onDone}
          style={{
            ...btnBase(T.surface2, T.textSec),
            border: `1px solid ${T.border}`,
          }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
