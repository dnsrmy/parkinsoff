# Parkinsoff

**Parkinson's Early Signal Awareness — Screening Shortcut**

Built for the **Google Build with AI Hackathon 2026** — Tech Roulette Challenge
IE University × GDG Madrid — April 2026

---

## Live Demo

**App:** https://parkinsoff-frontend-652530535904.europe-west1.run.app

**GitHub:** https://github.com/dnsrmy/Parkinsoff

---

## How to run locally

### Prerequisites
- Node.js 18+
- A Google Cloud project with Vertex AI and Speech-to-Text APIs enabled (not needed with `MOCK_AI=true`)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MOCK_AI=true for local testing without API keys
node src/index.js
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env — set VITE_BACKEND_URL=http://localhost:3001
npm run dev
```

Open http://localhost:5173

---

## What it does

Parkinsoff is a multimodal AI-powered screening shortcut that helps users identify early warning signals associated with Parkinson's disease — in under 10 minutes, from any device, without specialist equipment. It is **not a diagnostic tool** — it provides personal awareness, a structured clinical-style report, and a shortcut to knowing when to consult a healthcare professional.

### 7 Tests

| Test | Type | Signal measured |
|------|------|----------------|
| Sustained vowel | Voice — **strong** | Jitter, shimmer, HNR via Gemini AI |
| Finger tapping | Motor — **strong** | Bradykinesia, asymmetry |
| Rest tremor | Tremor — **strong** | 3–7 Hz accelerometer analysis |
| Pa-Ta-Ka | Voice — supporting | Speech motor control |
| Reading passage | Voice — supporting | Connected speech rate |
| Spiral drawing | Motor — supporting | Velocity CV, path deviation |
| Reaction time | Cognitive — supporting | Mean RT, variability |

### Scoring logic

- **Strong tests** (voice, tapping, tremor) drive the overall conclusion
- **Supporting tests** add context but do not change the result tier
- Rule-based reasoning — not score averaging
- Session context (sleep, caffeine, environment) applies as a confidence caveat only

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| AI | Google Vertex AI (Gemini 1.5 Pro) |
| Speech | Google Cloud Speech-to-Text |
| Deployment | Google Cloud Run (europe-west1) |
| Scoring | Research-based rule logic (UCI Parkinson's dataset) |

---

## Architecture

```
Browser (React SPA)
    │
    ▼
Cloud Run — Frontend (nginx, port 8080)
    │  /api/* proxied
    ▼
Cloud Run — Backend (Node.js/Express, port 3001)
    ├──▶ Vertex AI — Gemini 1.5 Pro  (voice analysis, explanations)
    └──▶ Google Cloud Speech-to-Text  (transcription)
```

API keys are stored server-side only. The frontend never holds credentials.

---

## Medical Disclaimer

This application does **not** diagnose Parkinson's disease or any other condition. Results are for personal awareness only. Always consult a qualified healthcare professional.

---

## Dataset Reference

Voice scoring thresholds derived from the UCI Oxford Parkinson's dataset (Little et al. 2008, n=195 recordings). All other test thresholds from published research: MDS-UPDRS III, Baken & Orlikoff 2000, Pullman 1998.
