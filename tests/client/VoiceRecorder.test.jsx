import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi } from 'vitest'
import VoiceRecorder from '../../client/src/VoiceRecorder.jsx'

global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null,
  onstop: null,
}))
MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)

global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  }),
}

describe('VoiceRecorder idle state', () => {
  it('renders "Tap to Record" button', () => {
    render(<VoiceRecorder />)
    expect(screen.getByRole('button', { name: /tap to record/i })).toBeInTheDocument()
  })

  it('does not show response or error initially', () => {
    render(<VoiceRecorder />)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
