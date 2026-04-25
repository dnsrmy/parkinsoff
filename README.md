# ParkinsonsShortcut

AI-powered early awareness assistant for Parkinson's disease prodromal signals.

> **Not a medical tool.** For awareness only. Always consult a healthcare professional.

Built for Tech Roulette / Build with AI — IE University x GDG Hackathon (April 2026).

---

## Phase 1 — Local Prototype (Mocked AI)

### Quickstart

```bash
# 1. Install frontend dependencies
cd frontend && npm install

# 2. Install backend dependencies
cd ../backend && npm install

# 3. Create backend .env
cp .env.example .env
# .env already has MOCK_AI=true

# 4. Start backend (port 3001)
npm run dev

# 5. In a new terminal, start frontend (port 5173)
cd ../frontend && npm run dev
```

Open http://localhost:5173

---

## Architecture

```
frontend (Vite + React)          backend (Express)
  ├── SymptomInput.jsx             ├── /api/analyze  (POST)
  │     └── signalDetector.js      │     └── geminiService.js
  ├── ResultsPanel.jsx             └── /health       (GET)
  ├── XPTracker.jsx
  └── DisclaimerBanner.jsx
```

### Signal Detection (client-side, real-time)

Runs locally on every keystroke via `detectSignals()`. No network call needed for chip display.

| Signal | Category | Weight |
|---|---|---|
| tremor | motor | 3 |
| smell_loss | prodromal | 3 |
| sleep_rbd | prodromal | 3 |
| constipation | prodromal | 2 |
| small_writing | motor | 2 |
| slowness | motor | 2 |
| mood | non-motor | 1 |
| fatigue | non-motor | 1 |

Severity: score ≥ 7 = **watch**, ≥ 4 = **medium**, ≥ 1 = **low**

---

## Phase 2 (upcoming)

- Replace `geminiService.js` mock with real Gemini / Vertex AI call
- Add Google Fit integration for activity data
- Camera-based tremor detection (MediaPipe Hands)
- Voice journaling via Web Speech API
