import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function callGeminiWithAudio(audioBuffer, mimeType = 'audio/mp4') {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
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

export async function callGeminiForLineItems(audioBuffer, mimeType, priceListItems) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId:   { type: 'string' },
                qty:      { type: 'number', nullable: true },
                needsQty: { type: 'boolean' },
              },
              required: ['itemId', 'qty', 'needsQty'],
            },
          },
        },
        required: ['transcript', 'items'],
      },
    },
  })

  const itemsContext = JSON.stringify(
    priceListItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))
  )

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBuffer.toString('base64'),
      },
    },
    {
      text: `You are a construction estimation assistant. The estimator will describe one or more line items by voice. Match each to items from the provided price list. For EA (each) items with no quantity mentioned, default qty to 1. For SF or LF items, set qty to null and needsQty to true if no measurement was spoken. Only match items that exist in the provided list. Return valid JSON only.\n\nPrice list:\n${itemsContext}`,
    },
  ])

  return JSON.parse(result.response.text())
}
