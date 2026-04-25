Live app: https://parkinsoff-frontend-652530535904.europe-west1.run.app
GitHub: https://github.com/dnsrmy/Parkinsoff

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (run from `frontend/`)
```bash
npm run dev       # Vite dev server — defaults to :5173, falls back to :5174
npm run build     # Production build
npm run preview   # Preview production build
```

### Backend (run from `backend/`)
```bash
npm run dev       # nodemon — auto-restarts on file changes
npm start         # node src/index.js — production start
```

Both must run simultaneously during development. The frontend reads `VITE_BACKEND_URL` (default `http://localhost:3001`) for all `/api/*` calls.

No test suite is configured on either side.

## Environment Variables

**`backend/.env`**
```
MOCK_AI=true             # Set to false to use real Google Cloud STT + Gemini
GEMINI_API_KEY=          # Required when MOCK_AI=false
PORT=3001
```

**`frontend/.env`**
```
VITE_BACKEND_URL=http://localhost:3001
```

With `MOCK_AI=true`, all `/api/voice/analyse`, `/api/pataka/analyse`, and `/api/reading/analyse` calls return randomised-but-plausible mock values without hitting any external API.

## Architecture

### Screen router
`frontend/src/App.jsx` is a string-based state machine. The `screen` variable drives rendering. Never manipulate it directly from children — always invoke a passed `on*` callback.

All screen names: `welcome`, `session_questionnaire`, `test`, `analyzing`, `results`, `home`, `history`, `export`, `profile`.

```
welcome → session_questionnaire → test (7-step loop) → results → home | history | export
```

Users with saved analyses land directly on `home` (DashboardScreen). The questionnaire (`SessionQuestionnaireScreen`) captures session context (sleep, caffeine, alcohol, environment, age) before the test sequence begins.

### 7-step test orchestration
`App.jsx` sequences tests via `currentTestIndex` (0–6) and `allTestResults` (accumulated object keyed by `testId`). Each test component receives `onComplete(result)`, `onSkip(result)`, `onBack()`, and `onRedo()`.

| # | testId | Component |
|---|--------|-----------|
| 0 | `sustained_vowel` | `VoiceStep` |
| 1 | `pataka` | `PatakaTest` |
| 2 | `reading_passage` | `ReadingPassageTest` |
| 3 | `finger_tapping` | `FingerTappingTest` |
| 4 | `spiral_drawing` | `SpiralStep` |
| 5 | `reaction_time` | `ReactionTimeTest` |
| 6 | `rest_tremor` | `RestTremorTest` |

`FaceStep.jsx` exists in `components/tests/` but is not part of the active test sequence.

When the final test completes, App.jsx writes three localStorage keys and navigates to `results`.

### Scoring pipeline
**Source of truth:** `frontend/src/utils/thresholds.js` — exact numeric cutoffs for every metric in every test.

`frontend/src/utils/scoringEngine.js` provides:
- `labelMetric(value, band)` → `'in_range' | 'borderline' | 'out_of_range'`
- `labelTest(metrics)` → worst label across all metrics
- `computeOverallResult(allTestResults, profileAnswers, sessionAnswers)` → tier + label + explanation

**Strong tests** (drive overall conclusion): `sustained_vowel`, `rest_tremor`, `finger_tapping`  
**Supporting tests** (narrative context only): `pataka`, `reading_passage`, `spiral_drawing`, `reaction_time`

Only `out_of_range` strong tests drive tier escalation. `borderline` never escalates the tier. Supporting tests never change the result tier.

| out_of_range strong | borderline strong | concordance | tier |
|---|---|---|---|
| 0 | 0 | — | `no_indicators` |
| 0 | ≥1 | — | `some_indicators_monitor` |
| 1 | any | no | `some_indicators_monitor` |
| 1 | any | yes | `some_indicators_followup` |
| ≥2 | any | — | `multiple_indicators` |

### Voice test fallback chain (PatakaTest, ReadingPassageTest)
Three-tier fallback — results are **always** produced:
1. Backend API (`/api/pataka/analyse` or `/api/reading/analyse`)
2. Browser Web Speech API (`window.SpeechRecognition`) — runs concurrently with `MediaRecorder` via `recognitionRef` + `transcriptRef`
3. Mock values matching the backend's own mock ranges

### Storage
All data is localStorage only. `frontend/src/utils/storage.js` handles legacy analysis history. New-flow test data uses its own keys written by `App.jsx`:

| Key | Written by | Contents |
|-----|-----------|----------|
| `parkinsons_allTestResults` | App.jsx (on test sequence complete) | `{ testId: { status, metrics, rawValues, timestamp } }` |
| `parkinsons_sessionAnswers` | App.jsx | Questionnaire answers |
| `parkinsons_profileAnswers` | App.jsx | Profile / onboarding data |
| `ps_analyses` | storage.js `saveAnalysis()` | Historical assessments, newest-first, max 50 |

DashboardScreen prefers in-session props over localStorage; falls back to localStorage on fresh load.

### Backend API
Express server (`backend/src/index.js`), routes in `backend/src/routes/`.

| Method | Path | Handler | Returns |
|--------|------|---------|---------|
| GET | `/health` | inline | `{ status: 'ok' }` |
| POST | `/api/analyze` | `routes/analyze.js` | Gemini explanatory text |
| POST | `/api/voice/analyse` | `routes/voice.js` | `{ voiceScore, phonationTime, amplitudeCV, … }` |
| POST | `/api/pataka/analyse` | `routes/pataka.js` | `{ syllable_rate, rhythm_cv }` |
| POST | `/api/reading/analyse` | `routes/reading.js` | `{ speech_rate_wpm, pause_ratio }` |

All audio routes accept `{ audio: base64, mimeType }`. CORS is locked to `localhost:5173–5175`.

### Dashboard and PDF export
`DashboardScreen` calls `computeOverallResult()` and renders strong/supporting test sections plus `TestGraphs.jsx` graph components. Each graph component has a null guard — returns "Test not completed yet" when `rawValues` is missing.

`exportToPdf(result, allAnalyses, {}, 0, null, spiralImageDataUrl, allTestResults, sessionAnswers, profileAnswers)` in `frontend/src/utils/exportPdf.js` builds an HTML document and triggers `window.print()`. No external PDF library.

### Design system
All styling is inline CSS-in-JS. Import design tokens from `frontend/src/design.js`:
- `T.*` — color tokens (`T.accent`, `T.red`, `T.green`, `T.muted`, `T.bg`, `T.surface`, `T.text`, `T.border`, etc.)
- `F.*` — font sizes as numbers (`F.display=36`, `F.h1=28`, `F.h2=22`, `F.h3=18`, `F.body=17`, `F.label=16`, `F.caption=14`, `F.small=13`)
- `btnPrimary(disabled)`, `btnSecondary(accent)`, `btnGhost` — button style objects to spread
- `card` — white surface preset
- `animStyle(visible, delay)` — fade-in animation helper (opacity + translateY)
- `redoBtn(active)` — redo button style (52×54px, color toggles on active)
- `TEST_TAB_CATEGORIES` — tab groupings: SYMPTOMS, VOICE, MOTOR, COGNITIVE, TREMORS

No CSS files, no CSS modules, no Tailwind.

### Key utility files
| File | Purpose |
|------|---------|
| `utils/thresholds.js` | Clinical reference ranges — source of truth for all scoring |
| `utils/scoringEngine.js` | Active rule-based scoring; use this, not testAnalyzer.js |
| `utils/questionnaires.js` | Session questionnaire schema definition |
| `utils/storage.js` | localStorage helpers for analysis history and profile |
| `utils/exportPdf.js` | PDF generation via window.print() |
| `utils/voiceProcessor.js` | Audio blob → base64 encoder; posts to backend |
| `utils/analysisEngine.js` | Legacy weighted fusion; not used by the current scoring pipeline |

### Known dead code
`MultiTestScreen.jsx`, `LoginScreen`, `LandingScreen`, `HomeScreen`, `AuthScreen`, `OnboardingScreen`, `TestScreen`, `UploadScreen` — not reachable from the current `App.jsx` router. `testAnalyzer.js` and `analysisEngine.js` contain legacy scoring logic superseded by `scoringEngine.js` + `thresholds.js`.
