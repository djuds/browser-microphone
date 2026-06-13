# Browser Microphone

Capture iPhone microphone audio in a React web app and get a response from Gemini AI.

## Local Development

```bash
npm install
cp .env.example server/.env
# Edit server/.env and add your GEMINI_API_KEY
npm run dev
```

Open `http://localhost:5173` in a browser (HTTPS required for mic on iOS — use Railway for iPhone testing).

## Production

```bash
npm run build
npm start
```

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Add environment variable: `GEMINI_API_KEY=<your key>`
5. Railway auto-deploys on every push and provides HTTPS

### Custom Domain

In Railway project settings → Domains → Add custom domain: `voice.mrdavidjudkins.com`

At your DNS provider, add a CNAME record:
- Name: `voice`
- Target: your Railway app URL (e.g. `browser-microphone-production.up.railway.app`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `PORT` | Server port (Railway sets this automatically) |

## Tests

```bash
npm test
```
