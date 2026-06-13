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
