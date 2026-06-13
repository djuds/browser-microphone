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
