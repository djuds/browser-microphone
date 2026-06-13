# Browser Microphone POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Express POC that captures iPhone Safari microphone audio (one-shot) and sends it to Gemini 1.5 Flash, displaying the text response — deployed to Railway at `voice.mrdavidjudkins.com`.

**Architecture:** Single Express server serves the compiled React frontend from `client/dist/` and handles `POST /api/voice`. In dev mode, Vite proxies `/api` to Express so the browser sees one origin — no CORS. In production, everything runs on the same Express port.

**Tech Stack:** React 18, Vite 5, Express 4, multer, @google/generative-ai, Vitest, supertest, @testing-library/react, Railway

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | All deps + dev/build/start/test scripts |
| `vitest.config.js` | Test runner: jsdom for client, node for server |
| `tests/setup.js` | jest-dom matchers |
| `tests/server/server.test.js` | Backend endpoint tests (supertest) |
| `tests/client/VoiceRecorder.test.jsx` | Component tests (RTL) |
| `server/index.js` | Express: static serving + /api/voice route |
| `server/gemini.js` | Gemini SDK wrapper (isolated, mockable) |
| `server/.env` | GEMINI_API_KEY (gitignored) |
| `client/vite.config.js` | Vite config + /api proxy for dev |
| `client/index.html` | HTML entry point |
| `client/src/main.jsx` | React mount |
| `client/src/App.jsx` | Root layout component |
| `client/src/App.css` | Global reset + layout |
| `client/src/VoiceRecorder.jsx` | Audio capture state machine + fetch |
| `client/src/VoiceRecorder.css` | Button, pulse animation, response card |
| `README.md` | Setup + deploy instructions |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `vitest.config.js`
- Create: `tests/setup.js`
- Create: `server/.env`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "browser-microphone",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite --config client/vite.config.js\" \"node server/index.js\"",
    "build": "vite build --config client/vite.config.js",
    "start": "node server/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.19.0",
    "multer": "^1.4.5-lts.1",
    "@google/generative-ai": "^0.21.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^8.2.0",
    "vitest": "^2.1.0",
    "supertest": "^7.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
client/dist/
server/.env
.env
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['tests/server/**', 'node'],
    ],
    setupFiles: ['tests/setup.js'],
  },
})
```

- [ ] **Step 4: Create `tests/setup.js`**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `server/.env`**

```
GEMINI_API_KEY=your_key_here
```

Replace `your_key_here` with a real key from https://aistudio.google.com/apikey

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `node_modules/` populated, no errors in output.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore vitest.config.js tests/setup.js
git commit -m "chore: project scaffold with deps and test config"
```

---

## Task 2: Express Server Skeleton (TDD)

**Files:**
- Create: `tests/server/server.test.js`
- Create: `server/index.js`

- [ ] **Step 1: Write the failing test**

Create `tests/server/server.test.js`:

```js
import request from 'supertest'
import app from '../../server/index.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/server.test.js`

Expected: FAIL — "Cannot find module '../../server/index.js'"

- [ ] **Step 3: Create `server/index.js`**

```js
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, '../client/dist')))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'))
})

const PORT = process.env.PORT || 3001
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

export default app
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/server.test.js`

Expected: 1 PASS

- [ ] **Step 5: Commit**

```bash
git add server/index.js tests/server/server.test.js
git commit -m "feat: express server skeleton with health check"
```

---

## Task 3: `/api/voice` Endpoint — File Upload (TDD)

**Files:**
- Modify: `server/index.js`
- Modify: `tests/server/server.test.js`

- [ ] **Step 1: Write failing upload tests**

Add to `tests/server/server.test.js` (after the existing `describe` block):

```js
describe('POST /api/voice', () => {
  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/voice')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'No audio file received.' })
  })

  it('returns 200 with a response property when file is attached', async () => {
    const audioBuffer = Buffer.from('fake-audio-data')
    const res = await request(app)
      .post('/api/voice')
      .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('response')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/server.test.js`

Expected: 2 FAIL — 404 Not Found (route doesn't exist yet)

- [ ] **Step 3: Add multer and stub route to `server/index.js`**

Add import at the top with the other imports:

```js
import multer from 'multer'
```

Add route after `app.use(express.static(...))` and before `app.get('/health', ...)`:

```js
const upload = multer({ storage: multer.memoryStorage() })

app.post('/api/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' })
  }
  res.json({ response: 'stub response' })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server/server.test.js`

Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add server/index.js tests/server/server.test.js
git commit -m "feat: add /api/voice endpoint with multer file upload"
```

---

## Task 4: Gemini Integration (TDD)

**Files:**
- Create: `server/gemini.js`
- Modify: `server/index.js`
- Modify: `tests/server/server.test.js`

- [ ] **Step 1: Add Gemini mock and update test**

At the very top of `tests/server/server.test.js` (before the `import request` line), add:

```js
import { vi } from 'vitest'

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'I heard you say hello.' },
      }),
    }),
  })),
}))
```

Replace the "returns 200" test body with a stricter assertion:

```js
it('returns 200 with response from Gemini when file is attached', async () => {
  const audioBuffer = Buffer.from('fake-audio-data')
  const res = await request(app)
    .post('/api/voice')
    .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ response: 'I heard you say hello.' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/server.test.js`

Expected: 1 FAIL — body is `{ response: 'stub response' }`, not `{ response: 'I heard you say hello.' }`

- [ ] **Step 3: Create `server/gemini.js`**

```js
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function callGeminiWithAudio(audioBuffer, mimeType = 'audio/mp4') {
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBuffer.toString('base64'),
      },
    },
    { text: 'Listen to this audio and respond helpfully to what the user said.' },
  ])
  return result.response.text()
}
```

- [ ] **Step 4: Wire Gemini into `server/index.js`**

Add import at the top:

```js
import { callGeminiWithAudio } from './gemini.js'
```

Replace the stub route body (keep the `!req.file` check, replace the stub line):

```js
app.post('/api/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' })
  }
  const text = await callGeminiWithAudio(req.file.buffer, req.file.mimetype)
  res.json({ response: text })
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/server/server.test.js`

Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add server/gemini.js server/index.js tests/server/server.test.js
git commit -m "feat: integrate Gemini 1.5 Flash for audio processing"
```

---

## Task 5: Backend Error Handling (TDD)

**Files:**
- Modify: `server/index.js`
- Modify: `tests/server/server.test.js`

- [ ] **Step 1: Write failing error test**

Add inside the existing `describe('POST /api/voice', ...)` block:

```js
it('returns 500 when Gemini throws', async () => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  GoogleGenerativeAI.mockImplementationOnce(() => ({
    getGenerativeModel: () => ({
      generateContent: vi.fn().mockRejectedValueOnce(new Error('API quota exceeded')),
    }),
  }))

  const audioBuffer = Buffer.from('fake-audio-data')
  const res = await request(app)
    .post('/api/voice')
    .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
  expect(res.status).toBe(500)
  expect(res.body).toEqual({ error: 'Failed to process audio. Please try again.' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/server.test.js`

Expected: 1 FAIL — unhandled rejection causes 500 but response body is not the expected JSON shape.

- [ ] **Step 3: Wrap the route in try/catch in `server/index.js`**

```js
app.post('/api/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' })
  }
  try {
    const text = await callGeminiWithAudio(req.file.buffer, req.file.mimetype)
    res.json({ response: text })
  } catch (err) {
    console.error('Gemini error:', err.message)
    res.status(500).json({ error: 'Failed to process audio. Please try again.' })
  }
})
```

- [ ] **Step 4: Run all server tests**

Run: `npm test -- tests/server/server.test.js`

Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add server/index.js tests/server/server.test.js
git commit -m "feat: add try/catch error handling to /api/voice"
```

---

## Task 6: Vite Client Scaffold

**Files:**
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`

No tests — structural scaffold. Verified in Task 11 (dev smoke test).

- [ ] **Step 1: Create `client/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

- [ ] **Step 2: Create `client/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voice to Gemini</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `client/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Create `client/src/App.jsx`**

```jsx
import VoiceRecorder from './VoiceRecorder.jsx'

export default function App() {
  return (
    <main>
      <h1>Voice to Gemini</h1>
      <VoiceRecorder />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add client/
git commit -m "feat: vite client scaffold with /api proxy"
```

---

## Task 7: VoiceRecorder — Render States (TDD)

**Files:**
- Create: `tests/client/VoiceRecorder.test.jsx`
- Create: `client/src/VoiceRecorder.jsx`
- Create: `client/src/VoiceRecorder.css` (empty placeholder)

- [ ] **Step 1: Write failing render tests**

Create `tests/client/VoiceRecorder.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi } from 'vitest'
import VoiceRecorder from '../../client/src/VoiceRecorder.jsx'

global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null,
  onstop: null,
}))
MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)

global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  }),
}

describe('VoiceRecorder idle state', () => {
  it('renders "Tap to Record" button', () => {
    render(<VoiceRecorder />)
    expect(screen.getByRole('button', { name: /tap to record/i })).toBeInTheDocument()
  })

  it('does not show response or error initially', () => {
    render(<VoiceRecorder />)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/VoiceRecorder.test.jsx`

Expected: FAIL — "Cannot find module '../../client/src/VoiceRecorder.jsx'"

- [ ] **Step 3: Create `client/src/VoiceRecorder.jsx`**

```jsx
import { useState, useRef } from 'react'
import './VoiceRecorder.css'

const STATES = { IDLE: 'idle', RECORDING: 'recording', SENDING: 'sending', DONE: 'done' }

export default function VoiceRecorder() {
  const [uiState, setUiState] = useState(STATES.IDLE)
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  function handleClick() {}

  return (
    <div className="voice-recorder">
      <button
        className={`record-btn record-btn--${uiState}`}
        onClick={handleClick}
        disabled={uiState === STATES.SENDING}
      >
        {(uiState === STATES.IDLE || uiState === STATES.DONE) && 'Tap to Record'}
        {uiState === STATES.RECORDING && 'Tap to Stop'}
        {uiState === STATES.SENDING && '...'}
      </button>
      {uiState === STATES.RECORDING && <div className="status-indicator" />}
      {error && <p role="alert" className="error-message">{error}</p>}
      {uiState === STATES.DONE && response && (
        <article className="response">{response}</article>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `client/src/VoiceRecorder.css`** (empty for now)

```css
/* styles added in Task 10 */
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/client/VoiceRecorder.test.jsx`

Expected: 2 PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/VoiceRecorder.jsx client/src/VoiceRecorder.css tests/client/VoiceRecorder.test.jsx
git commit -m "feat: VoiceRecorder skeleton with idle state rendering"
```

---

## Task 8: VoiceRecorder — Audio Capture Logic (TDD)

**Files:**
- Modify: `client/src/VoiceRecorder.jsx`
- Modify: `tests/client/VoiceRecorder.test.jsx`

- [ ] **Step 1: Write failing audio capture tests**

Add to `tests/client/VoiceRecorder.test.jsx`:

```jsx
describe('VoiceRecorder recording flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    let dataAvailableCallback = null
    let stopCallback = null

    global.MediaRecorder = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(function () {
        if (dataAvailableCallback) {
          dataAvailableCallback({ data: new Blob(['audio'], { type: 'audio/mp4' }) })
        }
        if (stopCallback) stopCallback()
      }),
      set ondataavailable(cb) { dataAvailableCallback = cb },
      set onstop(cb) { stopCallback = cb },
    }))
    MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Gemini says hello.' }),
    })
  })

  it('shows "Tap to Stop" and recording indicator after tapping record', async () => {
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tap to stop/i })).toBeInTheDocument()
      expect(document.querySelector('.status-indicator')).toBeInTheDocument()
    })
  })

  it('shows Gemini response after stopping recording', async () => {
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to stop/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('article')).toHaveTextContent('Gemini says hello.')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/VoiceRecorder.test.jsx`

Expected: 2 FAIL — clicking the button does nothing (`handleClick` is empty)

- [ ] **Step 3: Implement audio capture in `client/src/VoiceRecorder.jsx`**

Replace `function handleClick() {}` with the full implementation:

```jsx
async function startRecording() {
  setError('')
  setResponse('')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      streamRef.current.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType })
      await sendAudio(blob, mimeType)
    }

    recorder.start()
    setUiState(STATES.RECORDING)
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      setError('Microphone access is required. Please allow it in Safari settings.')
    } else {
      setError('Your browser does not support audio recording.')
    }
  }
}

function stopRecording() {
  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stop()
    setUiState(STATES.SENDING)
  }
}

async function sendAudio(blob, mimeType) {
  try {
    const ext = mimeType === 'audio/mp4' ? 'mp4' : 'webm'
    const form = new FormData()
    form.append('audio', blob, `recording.${ext}`)
    const res = await fetch('/api/voice', { method: 'POST', body: form })
    if (!res.ok) throw new Error('Server error')
    const data = await res.json()
    setResponse(data.response)
    setUiState(STATES.DONE)
  } catch {
    setError('Failed to send audio. Check your connection and try again.')
    setUiState(STATES.IDLE)
  }
}

function handleClick() {
  if (uiState === STATES.IDLE || uiState === STATES.DONE) startRecording()
  else if (uiState === STATES.RECORDING) stopRecording()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/client/VoiceRecorder.test.jsx`

Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/VoiceRecorder.jsx tests/client/VoiceRecorder.test.jsx
git commit -m "feat: implement one-shot audio capture, state machine, and Gemini send"
```

---

## Task 9: VoiceRecorder — Error Handling (TDD)

**Files:**
- Modify: `tests/client/VoiceRecorder.test.jsx`

(VoiceRecorder.jsx already has error handling from Task 8 — we're verifying it here.)

- [ ] **Step 1: Write failing error tests**

Add to `tests/client/VoiceRecorder.test.jsx`:

```jsx
describe('VoiceRecorder error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    let dataAvailableCallback = null
    let stopCallback = null

    global.MediaRecorder = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(function () {
        if (dataAvailableCallback) {
          dataAvailableCallback({ data: new Blob(['audio'], { type: 'audio/mp4' }) })
        }
        if (stopCallback) stopCallback()
      }),
      set ondataavailable(cb) { dataAvailableCallback = cb },
      set onstop(cb) { stopCallback = cb },
    }))
    MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'ok' }),
    })
  })

  it('shows mic permission message when getUserMedia is denied', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    )
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Microphone access is required. Please allow it in Safari settings.'
      )
    })
  })

  it('shows network error message when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to stop/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to send audio. Check your connection and try again.'
      )
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/VoiceRecorder.test.jsx`

Expected: 2 FAIL (error strings not matching, or component not rendering `role="alert"`)

If they pass already, skip to Step 4.

- [ ] **Step 3: Verify error message strings in `client/src/VoiceRecorder.jsx` match exactly**

Confirm these exact strings are present in VoiceRecorder.jsx:
- `'Microphone access is required. Please allow it in Safari settings.'`
- `'Failed to send audio. Check your connection and try again.'`

And the error `<p>` has `role="alert"` — it should from Task 7. No other code changes needed.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: All PASS (4 server + 6 client)

- [ ] **Step 5: Commit**

```bash
git add tests/client/VoiceRecorder.test.jsx
git commit -m "test: error handling — mic denied and network failure"
```

---

## Task 10: Styling

**Files:**
- Modify: `client/src/App.jsx`
- Create: `client/src/App.css`
- Modify: `client/src/VoiceRecorder.css`

No TDD — visual. Verified manually in Task 11.

- [ ] **Step 1: Update `client/src/App.jsx` to add CSS import**

```jsx
import VoiceRecorder from './VoiceRecorder.jsx'
import './App.css'

export default function App() {
  return (
    <main className="app">
      <h1 className="app-title">Voice to Gemini</h1>
      <VoiceRecorder />
    </main>
  )
}
```

- [ ] **Step 2: Create `client/src/App.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f0f0f;
  color: #f0f0f0;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem 1rem;
  max-width: 480px;
  width: 100%;
}

.app-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #a0a0a0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

- [ ] **Step 3: Replace contents of `client/src/VoiceRecorder.css`**

```css
.voice-recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.record-btn {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: transform 0.15s ease;
  color: #fff;
  background: #1a1a2e;
  box-shadow: 0 0 0 4px #2a2a4e;
}

.record-btn--idle:active,
.record-btn--done:active {
  transform: scale(0.96);
}

.record-btn--recording {
  background: #8b0000;
  animation: pulse-ring 1.5s ease infinite;
}

.record-btn--sending {
  background: #2a2a4e;
  cursor: not-allowed;
  opacity: 0.7;
}

@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 4px rgba(139, 0, 0, 0.6); }
  70%  { box-shadow: 0 0 0 20px rgba(139, 0, 0, 0); }
  100% { box-shadow: 0 0 0 4px rgba(139, 0, 0, 0); }
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff3b30;
  animation: blink 1s step-start infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.error-message {
  color: #ff6b6b;
  font-size: 0.875rem;
  text-align: center;
  max-width: 300px;
}

.response {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 12px;
  padding: 1.25rem;
  font-size: 1rem;
  line-height: 1.6;
  color: #e0e0e0;
  width: 100%;
  white-space: pre-wrap;
}
```

- [ ] **Step 4: Run all tests to confirm nothing broke**

Run: `npm test`

Expected: All PASS (CSS changes don't affect logic)

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/App.css client/src/VoiceRecorder.css
git commit -m "feat: mobile-first dark styling with recording pulse animation"
```

---

## Task 11: Dev Mode Smoke Test

Verify the full dev flow works in a desktop browser before building for iPhone.

- [ ] **Step 1: Start dev servers**

Run: `npm run dev`

Expected: Vite starts on `http://localhost:5173`. Express starts on `http://localhost:3001`. No errors in either process.

- [ ] **Step 2: Open in desktop browser and test golden path**

Open `http://localhost:5173` in Chrome or Firefox.

Verify:
- Dark page loads with "VOICE TO GEMINI" title and circular button
- Click "Tap to Record" → browser prompts for mic permission
- Allow mic → button changes to "Tap to Stop", red pulse animation visible
- Speak something → click "Tap to Stop" → brief "..." state, then Gemini response appears below button
- Click "Tap to Record" again → resets and records again

- [ ] **Step 3: Confirm proxy in DevTools**

Open DevTools → Network tab. Filter by `/api`. Confirm `POST /api/voice` shows as a same-origin request to `localhost:5173` (not `localhost:3001`). Status 200.

- [ ] **Step 4: Stop dev servers**

Press `Ctrl+C` in terminal.

---

## Task 12: Production Build Test

Verify Express correctly serves the built frontend before deploying.

- [ ] **Step 1: Build the client**

Run: `npm run build`

Expected: `client/dist/` folder created containing `index.html` and `assets/`. No errors.

- [ ] **Step 2: Start Express in production mode**

Run: `npm start`

Expected: `Server running on port 3001`

- [ ] **Step 3: Test in browser**

Open `http://localhost:3001`.

Verify:
- App loads (same appearance as dev mode)
- Full record → stop → response flow works
- DevTools Network shows `POST /api/voice` going directly to `localhost:3001`

- [ ] **Step 4: Stop Express**

Press `Ctrl+C`.

---

## Task 13: Railway Deployment + Custom Domain

- [ ] **Step 1: Create `.env.example` and `README.md`**

Create `server/.env.example`:

```
GEMINI_API_KEY=your_key_here
```

Create `README.md`:

```markdown
# Browser Microphone POC

Captures voice on iPhone Safari and sends to Gemini 1.5 Flash.  
Live at: https://voice.mrdavidjudkins.com

## Local Setup

1. `npm install`
2. Copy `server/.env.example` to `server/.env` and add your Gemini API key
3. `npm run dev` — Vite on :5173 (proxies /api to Express on :3001)

## Test

`npm test`

## Build & Preview

`npm run build && npm start` — Express serves built app on :3001

## Deploy

Push to `master` → Railway auto-deploys.  
Set `GEMINI_API_KEY` in Railway → Variables dashboard.
```

- [ ] **Step 2: Commit and push to GitHub**

```bash
git add server/.env.example README.md
git commit -m "docs: add README and .env.example"
git remote add origin https://github.com/YOUR_USERNAME/browser-microphone.git
git push -u origin master
```

Replace `YOUR_USERNAME` with your GitHub username.

- [ ] **Step 3: Create Railway project**

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select `browser-microphone` repo
3. Railway detects Node.js automatically

- [ ] **Step 4: Set environment variable in Railway**

In Railway dashboard → your service → Variables tab:

Add variable:
- Name: `GEMINI_API_KEY`
- Value: your actual Gemini API key

- [ ] **Step 5: Verify Railway deployment**

In Railway → Deployments tab: wait for green "Success" status.

Click the Railway-generated URL (e.g., `browser-microphone.up.railway.app`) — app should load and function.

- [ ] **Step 6: Add custom domain in Railway**

Railway dashboard → your service → Settings → Custom Domains → Add Domain:

Enter: `voice.mrdavidjudkins.com`

Railway shows you a CNAME target — copy it (e.g., `browser-microphone.up.railway.app`).

- [ ] **Step 7: Add CNAME record at hosting.com**

In hosting.com DNS manager:

| Type | Name | Value |
|------|------|-------|
| CNAME | `voice` | Railway CNAME target from Step 6 |

TTL: 300 (or lowest available). Save.

- [ ] **Step 8: Verify on iPhone**

DNS propagates in 5–30 minutes. Then open `https://voice.mrdavidjudkins.com` in Safari on iPhone.

Verify:
- HTTPS padlock appears
- Tapping "Tap to Record" triggers iOS mic permission prompt
- Full record → stop → Gemini response flow works
- No CORS errors in Safari dev console (Settings → Safari → Advanced → Web Inspector)
