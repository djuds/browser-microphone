import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(express.static(join(__dirname, '../client/dist')))
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

app.post('/api/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received.' })
  }
  res.json({ response: 'stub response' })
})

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
