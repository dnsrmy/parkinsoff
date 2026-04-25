import { useState } from 'react';
import { SESSION_QUESTIONNAIRE } from '../utils/questionnaires.js';

const T = {
  blue: '#7C6AF7', blueLight: 'rgba(124,106,247,0.08)', blueBorder: '#C4B5FD',
  border: '#E2E8F0', text: '#0F172A', sub: '#475569', muted: '#94A3B8',
};

export default function SessionQuestionnaireScreen({ onComplete }) {
  const [answers, setAnswers] = useState({});

  const allAnswered = SESSION_QUESTIONNAIRE.every(q => answers[q.id] !== undefined);

  function setAnswer(id, value) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    const resolved = {};
    for (const q of SESSION_QUESTIONNAIRE) {
      if (q.valueMap && answers[q.id] !== undefined) {
        resolved[q.id] = q.valueMap[answers[q.id]];
      } else {
        resolved[q.id] = answers[q.id];
      }
    }
    onComplete(resolved);
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>
        BEFORE WE START
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: T.text, marginBottom: 8 }}>
        A few quick questions
      </div>
      <div style={{ fontSize: 16, color: T.sub, lineHeight: 1.6, marginBottom: 28 }}>
        These help us note if today's conditions might affect your results. They do not change your screening outcome.
      </div>

      {SESSION_QUESTIONNAIRE.map(q => (
        <div
          key={q.id}
          style={{
            background: 'white', border: `1px solid ${T.border}`, borderRadius: 12,
            padding: 20, marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 14 }}>
            {q.label}
          </div>

          {q.type === 'boolean' && (
            <div style={{ display: 'flex', gap: 10 }}>
              {['Yes', 'No'].map(label => {
                const val = label === 'Yes' ? true : false;
                const selected = answers[q.id] === val;
                return (
                  <button
                    key={label}
                    onClick={() => setAnswer(q.id, val)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                      fontSize: 15, fontWeight: 500, border: '2px solid',
                      background: selected ? T.blue : 'white',
                      borderColor: selected ? T.blue : T.border,
                      color: selected ? 'white' : T.sub,
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === 'select' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {q.options.map(opt => {
                const selected = answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setAnswer(q.id, opt)}
                    style={{
                      padding: '8px 16px', borderRadius: 100, cursor: 'pointer',
                      fontSize: 14, border: selected ? '2px solid' : '1.5px solid',
                      background: selected ? T.blueLight : 'white',
                      borderColor: selected ? T.blue : T.border,
                      color: selected ? T.blue : T.sub,
                      fontWeight: selected ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        style={{
          width: '100%', padding: 16, borderRadius: 12, border: 'none',
          fontSize: 16, fontWeight: 600, marginTop: 8,
          background: allAnswered ? T.blue : '#CBD5E1',
          color: allAnswered ? 'white' : T.muted,
          cursor: allAnswered ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s',
        }}
      >
        Begin assessment
      </button>
      <div style={{ fontSize: 12, color: T.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>
        Your answers are used only to note reliability conditions — not to adjust results.
      </div>
    </div>
  );
}
