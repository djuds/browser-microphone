import { useState, useRef } from 'react'
import './VoiceRecorder.css'

export const STATES = { IDLE: 'idle', RECORDING: 'recording', SENDING: 'sending', DONE: 'done' }

export default function VoiceRecorder() {
  const [uiState, setUiState] = useState(STATES.IDLE)
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  async function startRecording() {
    setError('')
    setResponse('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Recording requires HTTPS. Please use a secure connection.')
      return
    }
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
        mediaRecorderRef.current = null
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
    } catch (err) {
      console.error('Send error:', err)
      setError('Failed to send audio. Check your connection and try again.')
      setUiState(STATES.IDLE)
    }
  }

  // DONE behaves like IDLE — tapping again starts a new recording
  function handleClick() {
    if (uiState === STATES.IDLE || uiState === STATES.DONE) startRecording()
    else if (uiState === STATES.RECORDING) stopRecording()
  }

  return (
    <div className="voice-recorder">
      <button
        className={`record-btn record-btn--${uiState}`}
        onClick={handleClick}
        disabled={uiState === STATES.SENDING}
      >
        {(uiState === STATES.IDLE || uiState === STATES.DONE) && 'Tap to Record'}
        {uiState === STATES.RECORDING && 'Tap to Stop'}
        {uiState === STATES.SENDING && <span aria-label="Sending">...</span>}
      </button>
      {uiState === STATES.RECORDING && <div className="status-indicator" />}
      {error && <p role="alert" className="error-message">{error}</p>}
      {uiState === STATES.DONE && response && (
        <article className="response">{response}</article>
      )}
    </div>
  )
}
