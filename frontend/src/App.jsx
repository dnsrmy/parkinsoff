import { useState } from 'react';
import {
  getUser, saveUser, saveAnalysis, updateSignalHistory,
  getAnalyses, getXp, saveXp,
} from './utils/storage.js';
import { analyzeSymptoms } from './services/apiService.js';
import { analyzeTestResults, buildSymptomsText } from './utils/testAnalyzer.js';
import { T } from './design.js';

import NavBar from './components/NavBar.jsx';
import WelcomeScreen from './screens/WelcomeScreen.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import MultiTestScreen from './screens/MultiTestScreen.jsx';
import AnalyzingScreen from './screens/AnalyzingScreen.jsx';
import ResultsScreen from './screens/ResultsScreen.jsx';
import HistoryScreen from './screens/HistoryScreen.jsx';
import ExportScreen from './screens/ExportScreen.jsx';
import SessionQuestionnaireScreen from './screens/SessionQuestionnaireScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';

import VoiceStep from './components/tests/VoiceStep.jsx';
import PatakaTest from './components/tests/PatakaTest.jsx';
import ReadingPassageTest from './components/tests/ReadingPassageTest.jsx';
import FingerTappingTest from './components/tests/FingerTappingTest.jsx';
import SpiralStep from './components/tests/SpiralStep.jsx';
import ReactionTimeTest from './components/tests/ReactionTimeTest.jsx';
import RestTremorTest from './components/tests/RestTremorTest.jsx';

const TEST_SEQUENCE = [
  'sustained_vowel',
  'pataka',
  'reading_passage',
  'finger_tapping',
  'spiral_drawing',
  'reaction_time',
  'rest_tremor',
];

const TEST_COMPONENTS = {
  sustained_vowel:  VoiceStep,
  pataka:           PatakaTest,
  reading_passage:  ReadingPassageTest,
  finger_tapping:   FingerTappingTest,
  spiral_drawing:   SpiralStep,
  reaction_time:    ReactionTimeTest,
  rest_tremor:      RestTremorTest,
};

const TEST_LABELS = {
  sustained_vowel:  'Voice (Sustained Vowel)',
  pataka:           'Pa-Ta-Ka',
  reading_passage:  'Reading Passage',
  finger_tapping:   'Finger Tapping',
  spiral_drawing:   'Spiral Drawing',
  reaction_time:    'Reaction Time',
  rest_tremor:      'Rest Tremor',
};

function computeLocalVoiceScore(r) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dur = r.phonationTime ?? 0;
  const cv  = r.amplitudeCV  ?? 0;
  const ev  = r.energyVariance ?? 0;
  const sr  = r.silenceRatio ?? 0;
  return Math.min(1,
    0.30 * clamp(1 - dur / 10, 0, 1) +
    0.35 * clamp(cv / 0.6,     0, 1) +
    0.20 * clamp(ev / 0.015,   0, 1) +
    0.10 * clamp(sr / 0.80,    0, 1)
  );
}

function normalizeTestResult(rawResult, testId) {
  // VoiceStep returns legacy shape: { completed, phonationTime, amplitudeCV, voiceTremor, voiceResult }
  if (testId === 'sustained_vowel' && rawResult.completed !== undefined) {
    // Use backend voiceScore if available, otherwise fall back to local PCM-based computation
    const vs = rawResult.voiceResult?.voiceScore ?? computeLocalVoiceScore(rawResult);
    const status = vs <= 0.33 ? 'in_range'
      : vs <= 0.66 ? 'borderline'
      : 'out_of_range';
    return {
      testId: 'sustained_vowel',
      status,
      metrics: {},
      rawValues: {
        voiceScore: vs,
        phonationTime: rawResult.phonationTime,
        amplitudeCV: rawResult.amplitudeCV,
        // Prefer locally-computed PCM rmsEnergy (reliable) over byte-level backend value
        rmsEnergy: rawResult.rmsEnergy ?? rawResult.voiceResult?.acousticFeatures?.rmsEnergy,
        energyVariance: rawResult.voiceResult?.acousticFeatures?.energyVariance ?? rawResult.energyVariance,
        silenceRatio: rawResult.voiceResult?.acousticFeatures?.silenceRatio ?? rawResult.silenceRatio,
        jitterProxy: rawResult.jitterProxy,
        energyEntropy: rawResult.energyEntropy,
      },
      voiceResult: rawResult.voiceResult,
      timestamp: Date.now(),
    };
  }

  // SpiralStep returns legacy shape: { completed, irregularity, pointCount, pathLength, spiralImageDataUrl, spiralResult }
  if (testId === 'spiral_drawing' && rawResult.completed !== undefined) {
    const sl = rawResult.spiralResult?.signalLevel;
    const status = sl === 'within_range' ? 'in_range'
      : sl === 'worth_monitoring' ? 'borderline'
      : sl === 'outside_range' ? 'out_of_range'
      : 'unknown';
    return {
      testId: 'spiral_drawing',
      status,
      metrics: {},
      rawValues: {
        irregularity: rawResult.irregularity,
        velocityCV: rawResult.spiralResult?.metrics?.velocityCV,
      },
      spiralResult: rawResult.spiralResult,
      spiralImageDataUrl: rawResult.spiralImageDataUrl,
      timestamp: Date.now(),
    };
  }

  // Standard shape from new test components — inject testId if missing
  return { ...rawResult, testId: rawResult.testId || testId };
}

export default function App() {
  const [screen, setScreen]               = useState('welcome');
  const [result, setResult]               = useState(null);
  const [exportTarget, setExportTarget]   = useState(null);
  const [prefillText, setPrefillText]     = useState('');
  const [faceImageDataUrl, setFaceImageDataUrl] = useState(null);

  // New clinical flow state
  const [sessionAnswers, setSessionAnswers]     = useState(null);
  const [allTestResults, setAllTestResults]     = useState({});
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [redoKey, setRedoKey] = useState(0);
  const [voiceStepDone, setVoiceStepDone] = useState(false);
  const [profileAnswers, setProfileAnswers]     = useState(() => {
    try { return getUser()?.onboarding || null; } catch { return null; }
  });

  const navigate = (screenName, options = {}) => {
    if (options.exportTarget !== undefined) setExportTarget(options.exportTarget);
    setScreen(screenName);
    window.scrollTo(0, 0);
  };

  function handleStart(text) {
    setPrefillText(text || '');
    setFaceImageDataUrl(null);
    navigate('session_questionnaire');
  }

  function goToNextTest(rawResult) {
    let updatedResults = allTestResults;
    if (rawResult) {
      const normalized = normalizeTestResult(rawResult, currentTestId);
      updatedResults = { ...allTestResults, [normalized.testId]: normalized };
      setAllTestResults(updatedResults);
    }
    const next = currentTestIndex + 1;
    if (next < TEST_SEQUENCE.length) {
      setCurrentTestIndex(next);
    } else {
      // Persist clinical session data for dashboard
      try {
        localStorage.setItem('parkinsons_allTestResults', JSON.stringify(updatedResults));
        localStorage.setItem('parkinsons_sessionAnswers', JSON.stringify(sessionAnswers));
        localStorage.setItem('parkinsons_profileAnswers', JSON.stringify(profileAnswers));
      } catch (_) {}
      navigate('results');
    }
  }

  function goToPreviousTest() {
    if (currentTestIndex > 0) setCurrentTestIndex(prev => prev - 1)
    else navigate('session_questionnaire')
  }

  function redoCurrentTest() {
    const id = TEST_SEQUENCE[currentTestIndex];
    setAllTestResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    setRedoKey(prev => prev + 1);
    setVoiceStepDone(false);
  }

  // Legacy flow (kept for backward compatibility — no longer the primary path)
  function handleTestSubmit(testData) {
    navigate('analyzing');
    const { signals, signalDetails, score, severity, testBreakdown } = analyzeTestResults(testData);
    const symptomsText = buildSymptomsText(testData, signals);

    analyzeSymptoms({ symptoms: symptomsText, detectedSignals: signals, severity })
      .then((res) => {
        const analysis = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          ...res,
          signalDetails,
          score,
          testBreakdown,
          faceImageDataUrl:   faceImageDataUrl || null,
          spiralImageDataUrl: testData.spiral?.spiralImageDataUrl || null,
          voiceResult:  testData.voice?.voiceResult  || null,
          spiralResult: testData.spiral?.spiralResult || null,
        };
        saveAnalysis(analysis);
        updateSignalHistory(res.detectedSignals || signals);
        const newXp = getXp() + 50;
        saveXp(newXp);
        setResult(analysis);
        navigate('results');
      })
      .catch(() => {
        navigate('home');
      });
  }

  function handleBackToDashboard() {
    if (getAnalyses().length > 0) {
      navigate('home');
    } else {
      navigate('welcome');
    }
  }

  const currentTestId = TEST_SEQUENCE[currentTestIndex];
  const CurrentTestComponent = TEST_COMPONENTS[currentTestId];

  return (
    <div style={{
      backgroundColor: T.bg,
      color: T.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      minHeight: '100dvh',
    }}>
      {screen === 'welcome' && (
        <WelcomeScreen
          onStart={handleStart}
          onViewDashboard={() => navigate('home')}
        />
      )}

      {screen === 'session_questionnaire' && (
        <SessionQuestionnaireScreen
          onComplete={(answers) => {
            setSessionAnswers(answers);
            setCurrentTestIndex(0);
            setAllTestResults({});
            setVoiceStepDone(false);
            navigate('test');
          }}
        />
      )}

      {screen === 'home' && (
        <DashboardScreen
          allTestResults={allTestResults}
          onNavigate={navigate}
          onRetake={() => {
            setCurrentTestIndex(0);
            setAllTestResults({});
            setVoiceStepDone(false);
            setSessionAnswers(null);
            setRedoKey(prev => prev + 1);
            navigate('session_questionnaire');
          }}
        />
      )}

      {screen === 'test' && CurrentTestComponent && (
        <div>
          <CurrentTestComponent
            onComplete={currentTestId === 'sustained_vowel'
              ? (rawResult) => {
                  if (rawResult) {
                    const normalized = normalizeTestResult(rawResult, 'sustained_vowel');
                    setAllTestResults(prev => ({ ...prev, [normalized.testId]: normalized }));
                  }
                  setVoiceStepDone(true);
                }
              : goToNextTest
            }
            onSkip={goToNextTest}
            onBack={goToPreviousTest}
            onRedo={redoCurrentTest}
            testIndex={currentTestIndex + 1}
            key={`${TEST_SEQUENCE[currentTestIndex]}-${redoKey}`}
            {...(currentTestId === 'reaction_time' ? { isOver65: sessionAnswers?.age_65_or_older === true } : {})}
          />
          {currentTestId === 'sustained_vowel' && voiceStepDone && (
            <div style={{ display: 'flex', gap: 12, padding: '16px 24px',
                          borderTop: '1px solid #E0E0E0', background: '#E8EAF6' }}>
              <button
                onClick={redoCurrentTest}
                style={{
                  flex: 1, height: 54, background: 'transparent', border: '1.5px solid #7C6AF7',
                  borderRadius: 28, fontSize: 15, fontWeight: 600, color: '#7C6AF7', cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Redo test
              </button>
              <button
                onClick={() => goToNextTest(null)}
                style={{
                  flex: 2, height: 54, background: '#7C6AF7', border: 'none',
                  borderRadius: 28, fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Next test
              </button>
            </div>
          )}
        </div>
      )}

      {screen === 'analyzing' && <AnalyzingScreen />}

      {screen === 'results' && (
        <ResultsScreen
          result={result}
          allTestResults={allTestResults}
          sessionAnswers={sessionAnswers}
          profileAnswers={profileAnswers}
          onContinue={() => {
            setCurrentTestIndex(0);
            setAllTestResults({});
            setVoiceStepDone(false);
            setSessionAnswers(null);
            setRedoKey(prev => prev + 1);
            navigate('session_questionnaire');
          }}
          onExport={() => {
            setExportTarget({ ...(result || {}), _clinicalData: { allTestResults, sessionAnswers, profileAnswers } });
            navigate('export');
          }}
          onBackToDashboard={handleBackToDashboard}
          onRetake={() => {
            setCurrentTestIndex(0);
            setAllTestResults({});
            setVoiceStepDone(false);
            setSessionAnswers(null);
            setRedoKey(prev => prev + 1);
            navigate('session_questionnaire');
          }}
          onViewHistory={() => navigate('history')}
        />
      )}

      {screen === 'history' && (
        <HistoryScreen
          onBack={() => navigate('home')}
          onExport={(analysis) => { setExportTarget(analysis); navigate('export'); }}
        />
      )}

      {screen === 'export' && (
        <ExportScreen
          target={exportTarget}
          onDone={() => navigate('home')}
        />
      )}

      {screen === 'profile' && (
        <ProfileScreen
          profileAnswers={profileAnswers}
          sessionAnswers={sessionAnswers}
          onNavigate={navigate}
        />
      )}

      <NavBar screen={screen} onNavigate={navigate} />
    </div>
  );
}
