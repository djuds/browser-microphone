# Browser Microphone POC — Design Spec
**Date:** 2026-06-13  
**Status:** Approved

---

## Overview

A React web app that captures voice from an iPhone microphone and sends the audio to the Gemini API, which returns a text response. This is a proof of concept scoped to audio capture + Gemini integration only. MCP server integration is out of scope for this phase.

---

## Goals

- Capture audio from iPhone Safari using the browser's native `MediaRecorder` API
- Send audio to Gemini 1.5 Flash and display the text response
- Work reliably on iOS Safari (the most constrained browser target)
- Zero CORS issues
- Accessible at a real HTTPS URL (`voice.mrdavidjudkins.com`)

## Non-Goals

- MCP server integration (future phase)
- Android / desktop browser optimization
- Audio playback
- Conversation history / multi-turn chat
- Authentication

---

## Architecture

```
iPhone Safari (React + Vite build)
    │
    │  POST /api/voice  (multipart/form-data, audio/mp4)
    ▼
Express (Node.js) — serves React build + API
    │
    │  @google/generative-ai SDK
    ▼
Gemini 1.5 Flash API
    │
    │  JSON { response: "..." }
    ▼
Express → iPhone Safari (displays text)
```

**Same-origin design:** Express serves the compiled React static files from `dist/` and handles the `/api/voice` endpoint on the same port. The browser never makes a cross-origin request, so CORS is not a factor.

---

## Interaction Model

One-shot voice input:

1. User opens `https://voice.mrdavidjudkins.com` on iPhone
2. Taps **"Tap to Record"** — browser prompts for microphone permission (first use only)
3. Recording begins; button changes to **"Tap to Stop"** with a recording indicator
4. User taps **"Tap to Stop"** — audio is sent to the server; spinner appears
5. Gemini's text response is displayed below the button
6. UI resets to `idle` state for another recording

---

## Frontend

### Stack
- React 18 + Vite
- No UI framework — plain CSS for minimal footprint
- No external state management — `useState` / `useRef` inside `VoiceRecorder`

### Component Structure

```
App
└── VoiceRecorder
    ├── RecordButton       (renders based on current state)
    ├── StatusIndicator    (visible only in `recording` state)
    └── ResponseDisplay    (visible only in `done` state)
```

### UI States

| State | Button Label | Other UI |
|-------|-------------|----------|
| `idle` | "Tap to Record" | — |
| `recording` | "Tap to Stop" | Pulsing red indicator |
| `sending` | Disabled spinner | — |
| `done` | "Tap to Record" (reset) | Gemini response text |

### Audio Capture

- `navigator.mediaDevices.getUserMedia({ audio: true })` — triggers iOS permission prompt
- `MediaRecorder` created with `mimeType: 'audio/mp4'` — required for iOS Safari; this is the only format iOS Safari's `MediaRecorder` produces
- Audio chunks collected via `dataavailable` event into an array
- On stop: chunks assembled into a `Blob`, sent as `FormData` via `fetch('/api/voice', { method: 'POST' })`

### iOS Safari Constraints

- HTTPS is required for `getUserMedia` — satisfied by Railway + custom domain
- `MediaRecorder` only outputs `audio/mp4` (AAC codec) on iOS — must be explicitly set as `mimeType`
- Microphone access requires a user gesture to initiate — satisfied by the tap interaction model
- `MediaRecorder` support begins at iOS 14.3

---

## Backend

### Stack
- Node.js + Express
- `multer` — handles `multipart/form-data` audio upload (memory storage, no disk writes)
- `@google/generative-ai` — official Gemini SDK
- `dotenv` — loads `GEMINI_API_KEY` from `.env`

### Endpoint

**`POST /api/voice`**

1. `multer` receives the `audio/mp4` file buffer from the request
2. Buffer is converted to base64
3. Gemini SDK called with:
   - Model: `gemini-1.5-flash`
   - Parts: a text prompt + an `inlineData` part (`mimeType: 'audio/mp4'`, base64 data)
   - System instruction: "You are a helpful assistant. Listen to the user's audio and respond helpfully to what they said."
4. Returns `{ response: "<gemini text>" }` on success
5. Returns `{ error: "<message>" }` with HTTP 500 on failure

### Static File Serving

Express serves `client/dist/` at the root route using `express.static`. All non-`/api` routes serve `index.html` (SPA fallback).

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Gemini API key — set in Railway dashboard, never committed |
| `PORT` | Set automatically by Railway; Express reads `process.env.PORT \|\| 3001` |

---

## Error Handling

| Failure Point | Detection | User-Facing Message |
|---------------|-----------|---------------------|
| Mic permission denied | `getUserMedia` rejects | "Microphone access is required. Please allow it in Safari settings." |
| `audio/mp4` not supported | `MediaRecorder` constructor throws | "Your browser doesn't support audio recording." |
| Network / upload failure | `fetch` rejects | "Failed to send audio. Check your connection and try again." |
| Gemini API error | Express returns 5xx | "Something went wrong. Please try again." |

All errors reset the UI to `idle` so the user can retry. No silent failures.

---

## File Structure

```
/
├── client/
│   ├── index.html
│   ├── vite.config.js          # proxy /api → localhost:3001 in dev mode
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── VoiceRecorder.jsx
│       └── VoiceRecorder.css
├── server/
│   ├── index.js                # Express app
│   └── .env                    # GEMINI_API_KEY (gitignored)
├── .gitignore
├── package.json                # root scripts: dev, build, start
└── README.md
```

### Root `package.json` Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Runs Vite dev server + Express concurrently (desktop dev) |
| `npm run build` | Builds React into `client/dist/` |
| `npm start` | Runs Express only (serves built `dist/` + API) |

---

## Development Workflow

### Desktop Development
```bash
npm run dev
# Vite on http://localhost:5173 (proxies /api → Express on :3001)
# Test in desktop browser at localhost:5173
```

### iPhone Testing
```bash
npm run build
npm start
# Express serves built app + API on :3001
# Railway provides https://voice.mrdavidjudkins.com
```

---

## Deployment

1. Push repo to GitHub
2. Create a new Railway project → connect GitHub repo
3. Railway auto-detects Node.js, runs `npm install` then `npm start`
4. Set `GEMINI_API_KEY` in Railway → Variables dashboard
5. Railway provisions an HTTPS URL automatically
6. In hosting.com DNS: add CNAME record `voice` → Railway-provided URL
7. In Railway: add custom domain `voice.mrdavidjudkins.com`
8. App is live at `https://voice.mrdavidjudkins.com`

---

## Dependencies

### Client
| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `vite`, `@vitejs/plugin-react` | Build tool |

### Server
| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `multer` | Multipart file upload |
| `@google/generative-ai` | Gemini SDK |
| `dotenv` | Env var loading |
| `concurrently` | Run dev servers together |
