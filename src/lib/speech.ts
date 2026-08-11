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

/**
 * @param options.continuous keep the microphone open across pauses and reopen it when the browser
 *   closes a session on its own. Placement wants one utterance (false, the default); a
 *   speak-to-survive game wants the mic live for the whole round (true).
 */
export function useSpeechRecognition(lang: string, options?: { continuous?: boolean }) {
  const continuous = options?.continuous ?? false
  const [supported] = useState(() => recognitionCtor() !== null)
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // True while the caller wants the mic open. onend consults it to decide between reopening (a
  // continuous round still in progress) and settling to idle.
  const wantOnRef = useRef(false)
  // Latest lang/continuous for the restart closure, which is created once.
  const configRef = useRef({ lang, continuous })
  configRef.current = { lang, continuous }

  // Stop any live recognition when the screen unmounts; a recogniser left running holds the mic open.
  useEffect(() => {
    return () => {
      wantOnRef.current = false
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const spawn = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = configRef.current.lang
    recognition.continuous = configRef.current.continuous
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
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantOnRef.current = false
        setStatus('denied')
      } else if (!configRef.current.continuous) {
        setStatus('failed')
      }
      // Continuous mode swallows transient errors (no-speech / network / aborted); onend reopens.
    }

    recognition.onend = () => {
      if (wantOnRef.current && configRef.current.continuous) {
        // Chrome ends a session on its own after a silence or its ~60s cap. Reopen (a fresh
        // instance, after a beat to dodge "already started") so the mic stays live for a long answer.
        window.setTimeout(() => {
          if (wantOnRef.current) spawn()
        }, 120)
        return
      }
      setStatus((current) => (current === 'listening' ? 'idle' : current))
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      if (wantOnRef.current && configRef.current.continuous) {
        window.setTimeout(() => {
          if (wantOnRef.current) spawn()
        }, 150)
      } else {
        setStatus('failed')
      }
    }
  }, [])

  const start = useCallback(() => {
    if (recognitionCtor() === null) return
    wantOnRef.current = true
    recognitionRef.current?.abort()
    setTranscript('')
    setStatus('listening')
    spawn()
  }, [spawn])

  const stop = useCallback(() => {
    wantOnRef.current = false
    recognitionRef.current?.stop()
    setStatus((current) => (current === 'listening' ? 'idle' : current))
  }, [])

  const reset = useCallback(() => {
    wantOnRef.current = false
    recognitionRef.current?.abort()
    setTranscript('')
    setStatus('idle')
  }, [])

  return { supported, status, transcript, start, stop, reset }
}
