import { useState } from 'react';
import { getUser, saveUser, getAnalyses, getXp, clearAll } from '../utils/storage.js';

const BG      = '#E8EAF6';
const PRIMARY = '#7C6AF7';
const CARD    = '#FFFFFF';
const TEXT    = '#1A1A2E';
const MUTED   = '#9E9EB0';

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: MUTED,
      margin: '24px 0 12px', paddingTop: 20,
      borderTop: '1px solid #E8E0FF',
    }}>
      {children}
    </div>
  );
}

function FieldRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #F0EFF8',
    }}>
      <span style={{ fontSize: 14, color: '#3D3D5C' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{value || '—'}</span>
    </div>
  );
}

function EditField({ label, value, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid #F0EFF8', gap: 12,
    }}>
      <span style={{ fontSize: 14, color: '#3D3D5C', flexShrink: 0 }}>{label}</span>
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 14, fontWeight: 600, color: TEXT,
          border: `1.5px solid ${PRIMARY}`, borderRadius: 8,
          padding: '4px 10px', outline: 'none',
          fontFamily: 'system-ui, sans-serif', width: '50%',
          backgroundColor: '#F9F8FF',
        }}
      />
    </div>
  );
}

export default function ProfileScreen({ profileAnswers, sessionAnswers, onNavigate }) {
  const [user, setUser]           = useState(() => getUser());
  const [isEditing, setIsEditing] = useState(false);
  const analyses  = getAnalyses();
  const xp        = getXp();
  const lastDate  = analyses[0]?.date
    ? new Date(analyses[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const pa = profileAnswers || user?.onboarding || {};

  const [editValues, setEditValues] = useState({
    name: user?.name || '',
    age_range: pa.age_range || '',
    sex: pa.sex || '',
    dominant_hand: pa.dominant_hand || '',
  });

  function handleEdit() {
    const currentPa = user?.onboarding || pa;
    setEditValues({
      name: user?.name || '',
      age_range: currentPa.age_range || '',
      sex: currentPa.sex || '',
      dominant_hand: currentPa.dominant_hand || '',
    });
    setIsEditing(true);
  }

  function handleSave() {
    const updated = {
      ...(user || {}),
      name: editValues.name,
      onboarding: {
        ...(user?.onboarding || {}),
        age_range: editValues.age_range,
        sex: editValues.sex,
        dominant_hand: editValues.dominant_hand,
      },
    };
    saveUser(updated);
    setUser(updated);
    setIsEditing(false);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  function handleClearData() {
    if (window.confirm('This will permanently delete all your data. Continue?')) {
      clearAll();
      onNavigate('welcome');
    }
  }

  const displayPa = user?.onboarding || pa;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>
      <div style={{ backgroundColor: CARD, borderBottom: '1px solid #E0E0E0', padding: '16px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>Profile</div>
      </div>

      <div style={{ padding: '8px 24px 40px', maxWidth: 680, margin: '0 auto' }}>

        {/* Section 1: Your Profile */}
        <SectionTitle>Your profile</SectionTitle>
        <div style={{ backgroundColor: CARD, borderRadius: 16, padding: '4px 16px', boxShadow: '0 2px 8px rgba(26,26,46,0.06)' }}>

          {/* Edit/Save/Cancel header */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, paddingBottom: 4 }}>
            {!isEditing ? (
              <button
                onClick={handleEdit}
                style={{
                  background: 'none', border: `1.5px solid ${PRIMARY}`,
                  borderRadius: 20, padding: '4px 14px',
                  fontSize: 13, fontWeight: 600, color: PRIMARY,
                  cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                }}
              >
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCancel}
                  style={{
                    background: 'none', border: '1.5px solid #D8D6F0',
                    borderRadius: 20, padding: '4px 14px',
                    fontSize: 13, fontWeight: 600, color: MUTED,
                    cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    backgroundColor: PRIMARY, border: 'none',
                    borderRadius: 20, padding: '4px 16px',
                    fontSize: 13, fontWeight: 700, color: '#fff',
                    cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <>
              <EditField label="Name" value={editValues.name} onChange={v => setEditValues(p => ({ ...p, name: v }))} />
              <EditField label="Age range" value={editValues.age_range} onChange={v => setEditValues(p => ({ ...p, age_range: v }))} />
              <EditField label="Sex" value={editValues.sex} onChange={v => setEditValues(p => ({ ...p, sex: v }))} />
              <EditField label="Dominant hand" value={editValues.dominant_hand} onChange={v => setEditValues(p => ({ ...p, dominant_hand: v }))} />
            </>
          ) : (
            <>
              <FieldRow label="Name" value={user?.name} />
              <FieldRow label="Age range" value={displayPa.age_range} />
              <FieldRow label="Sex" value={displayPa.sex} />
              <FieldRow label="Dominant hand" value={displayPa.dominant_hand} />
              <FieldRow label="Family history" value={user?.familyHistory ? 'Yes' : 'No'} />
            </>
          )}
        </div>

        {/* Section 2: Session History */}
        <SectionTitle>Session history</SectionTitle>
        <div style={{ backgroundColor: CARD, borderRadius: 16, padding: '4px 16px', boxShadow: '0 2px 8px rgba(26,26,46,0.06)' }}>
          <FieldRow label="Total assessments" value={analyses.length.toString()} />
          <FieldRow label="Last assessment" value={lastDate || 'None yet'} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 14, color: '#3D3D5C' }}>XP total</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>{xp}</span>
          </div>
        </div>

        {/* Section 3: Actions */}
        <SectionTitle>Actions</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => onNavigate('session_questionnaire')}
            style={{
              height: 52, backgroundColor: PRIMARY, color: '#fff', border: 'none',
              borderRadius: 100, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Start new assessment
          </button>
          <button
            onClick={handleClearData}
            style={{
              height: 52, backgroundColor: 'transparent', color: '#DC2626',
              border: '1.5px solid #FECACA', borderRadius: 100,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Clear all data
          </button>
        </div>

      </div>
    </div>
  );
}
