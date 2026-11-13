import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'

type Capture = { stream?: MediaStream; recorder?: MediaRecorder; timer?: number }

export function SawMicCheck({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [phase, setPhase] = useState<'ready' | 'requesting' | 'recording'>('ready')
  const [clip, setClip] = useState('')
  const [error, setError] = useState('')
  const capture = useRef<Capture | null>(null)
  const clipUrl = useRef('')
  const supported = typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

  const releaseCapture = useCallback(() => {
    const current = capture.current
    if (!current) return
    capture.current = null
    window.clearTimeout(current.timer)
    if (current.recorder) {
      current.recorder.ondataavailable = null
      current.recorder.onerror = null
      current.recorder.onstop = null
      try { if (current.recorder.state !== 'inactive') current.recorder.stop() } catch { /* The browser may have already stopped the recorder. */ }
    }
    current.stream?.getTracks().forEach((track) => track.stop())
    onActiveChange?.(false)
  }, [onActiveChange])

  const releaseClip = useCallback(() => {
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
    clipUrl.current = ''
  }, [])

  useEffect(() => {
    const stopWhenHidden = () => {
      if (!document.hidden || !capture.current) return
      releaseCapture()
      setPhase('ready')
    }
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden)
      releaseCapture()
      releaseClip()
    }
  }, [releaseCapture, releaseClip])

  const record = async () => {
    if (!supported || capture.current) return
    const current: Capture = {}
    capture.current = current
    onActiveChange?.(true)
    releaseClip()
    setClip('')
    setError('')
    setPhase('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (capture.current !== current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      current.stream = stream
      const recorder = new MediaRecorder(stream)
      current.recorder = recorder
      const parts: Blob[] = []
      recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data) }
      recorder.onstop = () => {
        if (capture.current !== current) return
        releaseCapture()
        setPhase('ready')
        if (parts.length === 0) {
          setError('Запись пуста. Проверь микрофон и попробуй снова.')
          return
        }
        clipUrl.current = URL.createObjectURL(new Blob(parts, { type: recorder.mimeType || parts[0].type }))
        setClip(clipUrl.current)
      }
      recorder.onerror = () => {
        if (capture.current !== current) return
        releaseCapture()
        setPhase('ready')
        setError('Браузер не смог записать звук.')
      }
      recorder.start()
      setPhase('recording')
      current.timer = window.setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, 3000)
    } catch {
      if (capture.current !== current) return
      releaseCapture()
      setPhase('ready')
      setError('Не удалось сделать запись. Проверь доступ к микрофону в браузере.')
    }
  }

  if (!supported) return null

  return <div className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-2">
    <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-bold text-[var(--arra-muted)] hover:border-[var(--arra-accent)] hover:text-[var(--arra-accent)]"
      onClick={() => {
        if (phase === 'recording' && capture.current?.recorder?.state === 'recording') capture.current.recorder.stop()
        else if (phase === 'requesting') { releaseCapture(); setPhase('ready') }
        else void record()
      }}>
      {phase === 'recording' ? <Square size={14} aria-hidden="true" /> : phase === 'requesting' ? <X size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
      {phase === 'recording' ? 'Остановить запись' : phase === 'requesting' ? 'Отменить' : 'Проверить микрофон'}
    </button>
    {phase === 'requesting' && <span className="text-xs text-[var(--arra-muted)]" role="status">Ожидаем доступ к микрофону…</span>}
    {phase === 'recording' && <span className="text-xs text-[var(--arra-accent)]" role="status">Скажи пару слов. Запись длится 3 секунды.</span>}
    {clip && <audio className="h-9 w-full max-w-72" controls controlsList="nodownload" src={clip} preload="metadata" aria-label="Пробная запись микрофона" />}
    {error && <span className="text-xs text-[#ffc0b4]" role="alert">{error}</span>}
  </div>
}
