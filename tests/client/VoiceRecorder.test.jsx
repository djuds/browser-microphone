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

describe('VoiceRecorder recording flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    let dataAvailableCallback = null
    let stopCallback = null

    global.MediaRecorder = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(function () {
        if (dataAvailableCallback) {
          dataAvailableCallback({ data: new Blob(['audio'], { type: 'audio/mp4' }) })
        }
        if (stopCallback) stopCallback()
      }),
      set ondataavailable(cb) { dataAvailableCallback = cb },
      set onstop(cb) { stopCallback = cb },
    }))
    MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Gemini says hello.' }),
    })
  })

  it('shows "Tap to Stop" and recording indicator after tapping record', async () => {
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tap to stop/i })).toBeInTheDocument()
      expect(document.querySelector('.status-indicator')).toBeInTheDocument()
    })
  })

  it('shows Gemini response after stopping recording', async () => {
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to stop/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('article')).toHaveTextContent('Gemini says hello.')
    })
  })
})

describe('VoiceRecorder error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    let dataAvailableCallback = null
    let stopCallback = null

    global.MediaRecorder = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(function () {
        if (dataAvailableCallback) {
          dataAvailableCallback({ data: new Blob(['audio'], { type: 'audio/mp4' }) })
        }
        if (stopCallback) stopCallback()
      }),
      set ondataavailable(cb) { dataAvailableCallback = cb },
      set onstop(cb) { stopCallback = cb },
    }))
    MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'ok' }),
    })
  })

  it('shows mic permission message when getUserMedia is denied', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    )
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Microphone access is required. Please allow it in Safari settings.'
      )
    })
  })

  it('shows network error message when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    render(<VoiceRecorder />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to record/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tap to stop/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to send audio. Check your connection and try again.'
      )
    })
  })
})
