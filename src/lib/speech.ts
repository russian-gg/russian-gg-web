import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Placement asks the learner to *speak*. Typing Cyrillic on a phone is a wall for exactly the
 * beginner the question is aimed at, so the browser's own recogniser carries the common case
 * and the caller falls back to a text field wherever it is missing (Firefox, old WebViews).
 *
 * This is deliberately not the Gemini Live path used by missions: a placement item needs a
 * transcript, not a tutor, and must not cost a voice-budget second.
 */

interface RecognitionAlternative {
  transcript: string
}

interface RecognitionResult extends ArrayLike<RecognitionAlternative> {
  isFinal: boolean
}

interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export type SpeechStatus = 'idle' | 'listening' | 'denied' | 'failed'

export function useSpeechRecognition(lang: string) {
  const [supported] = useState(() => recognitionCtor() !== null)
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  // Stop any live recognition when the item changes or the screen unmounts; a recogniser left
  // running holds the microphone open.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) return

    recognitionRef.current?.abort()

    const recognition = new Ctor()
    recognition.lang = lang
    // One answer, one utterance: stopping on the learner's natural pause is the whole point.
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript
      }
      setTranscript(text.trim())
    }

    recognition.onerror = (event) => {
      setStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'failed')
    }

    recognition.onend = () => {
      setStatus((current) => (current === 'listening' ? 'idle' : current))
    }

    recognitionRef.current = recognition
    setTranscript('')
    setStatus('listening')

    try {
      recognition.start()
    } catch {
      setStatus('failed')
    }
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setStatus((current) => (current === 'listening' ? 'idle' : current))
  }, [])

  const reset = useCallback(() => {
    recognitionRef.current?.abort()
    setTranscript('')
    setStatus('idle')
  }, [])

  return { supported, status, transcript, start, stop, reset }
}
