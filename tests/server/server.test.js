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

import request from 'supertest'
import app from '../../server/index.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('POST /api/voice', () => {
  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/voice')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'No audio file received.' })
  })

  it('returns 200 with response from Gemini when file is attached', async () => {
    const audioBuffer = Buffer.from('fake-audio-data')
    const res = await request(app)
      .post('/api/voice')
      .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ response: 'I heard you say hello.' })
  })

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
})
