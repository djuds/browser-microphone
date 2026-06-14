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
import { callGeminiForLineItems } from '../../server/gemini.js'

describe('CORS', () => {
  it('allows requests from dpj.design', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://dpj.design')
    expect(res.headers['access-control-allow-origin']).toBe('https://dpj.design')
  })

  it('allows requests from localhost:5173', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })
})

describe('callGeminiForLineItems', () => {
  const sampleItems = [
    { id: 'demo_vanity', name: 'Remove bathroom vanity', unit: 'EA' },
    { id: 'demo_drywall', name: 'Remove drywall', unit: 'SF' },
  ]

  it('returns parsed structured object from Gemini response', async () => {
    const geminiResponse = {
      transcript: 'demo vanity',
      items: [{ itemId: 'demo_vanity', qty: 1, needsQty: false }],
    }
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    GoogleGenerativeAI.mockImplementationOnce(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => JSON.stringify(geminiResponse) },
        }),
      }),
    }))

    const result = await callGeminiForLineItems(
      Buffer.from('fake-audio'),
      'audio/mp4',
      sampleItems
    )
    expect(result).toEqual(geminiResponse)
  })

  it('throws when Gemini returns invalid JSON', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    GoogleGenerativeAI.mockImplementationOnce(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'not valid json' },
        }),
      }),
    }))

    await expect(
      callGeminiForLineItems(Buffer.from('fake-audio'), 'audio/mp4', sampleItems)
    ).rejects.toThrow()
  })
})

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

describe('POST /api/parse-line-item', () => {
  const sampleItems = [
    { id: 'demo_vanity', name: 'Remove bathroom vanity', unit: 'EA' },
    { id: 'demo_drywall', name: 'Remove drywall',        unit: 'SF' },
  ]

  it('returns 400 when no audio file is attached', async () => {
    const res = await request(app)
      .post('/api/parse-line-item')
      .field('priceListItems', JSON.stringify(sampleItems))
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'No audio file received.' })
  })

  it('returns 400 when priceListItems is missing', async () => {
    const audioBuffer = Buffer.from('fake-audio-data')
    const res = await request(app)
      .post('/api/parse-line-item')
      .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'priceListItems is required.' })
  })

  it('returns 400 when priceListItems is invalid JSON', async () => {
    const audioBuffer = Buffer.from('fake-audio-data')
    const res = await request(app)
      .post('/api/parse-line-item')
      .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
      .field('priceListItems', 'not-valid-json')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'priceListItems must be valid JSON.' })
  })

  it('returns 200 with structured items from Gemini', async () => {
    const geminiResponse = {
      transcript: 'demo vanity and drywall',
      items: [
        { itemId: 'demo_vanity', qty: 1,    needsQty: false },
        { itemId: 'demo_drywall', qty: null, needsQty: true  },
      ],
    }
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    GoogleGenerativeAI.mockImplementationOnce(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => JSON.stringify(geminiResponse) },
        }),
      }),
    }))

    const audioBuffer = Buffer.from('fake-audio-data')
    const res = await request(app)
      .post('/api/parse-line-item')
      .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
      .field('priceListItems', JSON.stringify(sampleItems))

    expect(res.status).toBe(200)
    expect(res.body).toEqual(geminiResponse)
  })

  it('returns 500 when Gemini throws', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    GoogleGenerativeAI.mockImplementationOnce(() => ({
      getGenerativeModel: () => ({
        generateContent: vi.fn().mockRejectedValueOnce(new Error('API error')),
      }),
    }))

    const audioBuffer = Buffer.from('fake-audio-data')
    const res = await request(app)
      .post('/api/parse-line-item')
      .attach('audio', audioBuffer, { filename: 'recording.mp4', contentType: 'audio/mp4' })
      .field('priceListItems', JSON.stringify(sampleItems))

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to process audio. Please try again.' })
  })
})
