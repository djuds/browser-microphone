import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import multer from 'multer'
import cors from 'cors'
import { callGeminiWithAudio, callGeminiForLineItems } from './gemini.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://estimate.dpj.design').split(',')
app.use(cors({ origin: allowedOrigins }))
app.use(express.static(join(__dirname, '../client/dist')))
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

app.use('/api', (req, res, next) => {
  const key = req.headers['x-api-key']
  if (!key || key !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.post('/api/voice', upload.single('audio'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' })
  }
  try {
    const text = await callGeminiWithAudio(req.file.buffer, req.file.mimetype)
    res.json({ response: text })
  } catch (err) {
    next(err)
  }
})

app.post('/api/parse-line-item', upload.single('audio'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file received.' })
  if (!req.body.priceListItems) return res.status(400).json({ error: 'priceListItems is required.' })

  let priceListItems
  try {
    priceListItems = JSON.parse(req.body.priceListItems)
  } catch {
    return res.status(400).json({ error: 'priceListItems must be valid JSON.' })
  }

  try {
    const result = await callGeminiForLineItems(req.file.buffer, req.file.mimetype, priceListItems)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'))
})

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large.' })
  console.error('Server error:', err.message)
  res.status(500).json({ error: 'Failed to process audio. Please try again.' })
})

const PORT = process.env.PORT || 3001
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

export default app
