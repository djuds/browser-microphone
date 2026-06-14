import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import multer from 'multer'
import cors from 'cors'
import { callGeminiWithAudio } from './gemini.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors({ origin: ['https://dpj.design', 'http://localhost:5173'] }))
app.use(express.static(join(__dirname, '../client/dist')))
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

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
