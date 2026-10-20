import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { Check, Share2 } from 'lucide-react'
import type { Select } from '../../../components/forms/Select'
import type { GameSession } from '../../../lib/speaking-games'
import type { GameCopy } from './copy'
import './tez-gapir.css'

const art = '/games/characters'

export function TezGapirLevelPicker({ value, onChange, options, label, disabled }: ComponentProps<typeof Select>) {
  const name = useId()
  return <fieldset className="tg-levels" role="radiogroup" aria-label={label} disabled={disabled}>
    {options.filter((option) => option.value).map((option) => <label key={option.value} data-selected={value === option.value}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
      <span className="tg-level-string" aria-hidden="true" /><strong>{option.label}</strong>
    </label>)}
  </fieldset>
}

export function TezGapirBackdrop() {
  return <div className="tg-backdrop" aria-hidden="true">
    <div className="tg-night" />
    <div className="tg-stars">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 47.3) % 100}%`, top: `${(i * 19.7) % 70}%`, '--tg-delay': `${i * -.41}s` } as CSSProperties} />)}</div>
  </div>
}

export function TezGapirPortrait({ character, selected = false }: { character: GameSession['character']; selected?: boolean }) {
  return <span className="tg-portrait" data-character={character} data-selected={selected} aria-hidden="true">
    <span className="tg-portrait-motion"><span className="tg-portrait-window">
      <img src={`${art}/${character}.webp`} alt="" width={512} height={512} />
    </span></span>
  </span>
}

function Campfire({ remaining, energy = 0, record = false }: { remaining: number; energy?: number; record?: boolean }) {
  return <div className="tg-campfire" data-extinguished={remaining === 0} data-record={record} aria-hidden="true" style={{
    '--tg-fire-scale': .3 + remaining * .7 + energy * .12,
    '--tg-fire-opacity': remaining === 0 ? 0 : Math.min(1, remaining * 2 + .1 + energy * .25),
    '--tg-fire-light': 1 + energy * .4,
    '--tg-ember-opacity': remaining === 0 ? .25 : .35 + remaining * .4 + energy * .25,
  } as CSSProperties}>
    <div className="tg-fire-glow" />
    <div className="tg-coals" />
    <div className="tg-flame-volume">{['0% 0%', '100% 0%', '0% 100%'].map((position, i) => <span key={position} style={{ backgroundPosition: position, animationDelay: `${i * -1.4}s` }} />)}</div>
    <div className="tg-embers">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{
      '--tg-x': `${28 + (i * 13) % 45}%`, '--tg-drift': `${((i * 37) % 150) - 75}px`, '--tg-delay': `${i * -.27}s`, '--tg-duration': `${2 + (i % 5) * .4}s`,
    } as CSSProperties} />)}</div>
    {record && <div className="tg-record-sparks">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--tg-angle': `${i * 360 / 28}deg`, '--tg-distance': `${100 + i % 4 * 20}px`, '--tg-delay': `${i % 4 * .12}s` } as CSSProperties} />)}</div>}
  </div>
}

function useVoiceGlow(transcript: string, listening: boolean) {
  const [energy, setEnergy] = useState(0)
  const previous = useRef('')
  useEffect(() => {
    if (!listening || !transcript || transcript === previous.current) { setEnergy(0); return }
    const added = Math.abs(transcript.length - previous.current.length)
    previous.current = transcript
    setEnergy(Math.min(1, .35 + added / 35))
    const timeout = window.setTimeout(() => setEnergy(0), 1100)
    return () => window.clearTimeout(timeout)
  }, [transcript, listening])
  return energy
}

function LivingFireScene({ session, seconds, listening, transcript, copy, children }: Omit<ComponentProps<typeof TezGapirScene>, 'enabled'>) {
  const energy = useVoiceGlow(transcript, listening)
  const [lastActiveSeconds, setLastActiveSeconds] = useState(() => {
    const turn = session.history.find((entry) => entry.roundIndex === session.roundIndex)
    if (session.status !== 'feedback' || !session.roundStartedAt || !turn) return seconds
    const elapsed = (Date.parse(turn.answeredAt) - Date.parse(session.roundStartedAt)) / 1000
    return Number.isFinite(elapsed) ? Math.max(0, Math.min(session.durationSeconds, session.durationSeconds - elapsed)) : seconds
  })
  if (session.status === 'answering' && lastActiveSeconds !== seconds) setLastActiveSeconds(seconds)
  const displayedSeconds = session.status === 'feedback' ? lastActiveSeconds : seconds
  const remaining = Math.max(0, Math.min(1, displayedSeconds / Math.max(1, session.durationSeconds)))
  const verified = session.status === 'feedback'
  const words = verified
    ? (session.feedback?.words.filter((word) => word.points > 0).map((word) => ({ text: word.text, gender: ['masculine', 'feminine', 'neuter'].includes(word.category) ? word.category : undefined })) ?? [])
    : transcript.trim().split(/\s+/).filter(Boolean).map((text) => ({ text, gender: undefined }))
  const response = verified && session.feedback?.correct != null ? session.feedback.correct ? 'correct' : 'incorrect' : 'neutral'
  return <div className="tg-scene" data-character={session.character} data-listening={listening} data-voice-active={energy > 0} data-response={response} style={{ '--tg-voice': energy } as CSSProperties}>
    <div className="tg-topic" key={session.prompt.id}>
      {session.prompt.kind !== 'ready' && <span className="tg-eyebrow">{copy.theme}</span>}
      {children}
    </div>
    <div className="tg-fire-stage">
      <aside className="tg-mentor"><TezGapirPortrait character={session.character} /><span>{copy[session.character === 'pero' ? 'feather' : session.character]}</span></aside>
      <Campfire remaining={remaining} energy={energy} />
      <div className="tg-word-sparks" aria-hidden="true" data-verified={verified}>{words.slice(-5).map((word, i) => <span key={`${words.length - 5 + i}:${word.text}`} data-gender={word.gender} style={{ '--tg-drift': `${(i - 2) * 34}px`, '--tg-delay': `${i * .15}s` } as CSSProperties}>{word.text}</span>)}</div>
      <div className="tg-fire-timer" role="timer" aria-label={`${Math.ceil(displayedSeconds)} ${copy.seconds}`} data-extinguished={remaining === 0}><strong>{Math.ceil(displayedSeconds)}</strong><small>{copy.seconds}</small></div>
    </div>
    <svg className="tg-voice-line" viewBox="0 0 320 36" aria-hidden="true">
      <path d="M0 23Q55 23 80 22T112 19Q125 3 137 23T162 20Q177 0 187 23T215 22Q245 23 320 23" />
      <path d="M0 23Q70 23 107 24Q130 34 145 19T177 25Q195 31 213 23T320 23" />
      <path d="M0 23Q88 23 120 21Q143 12 159 24T193 21Q220 23 320 23" />
    </svg>
  </div>
}

export function TezGapirScene({ enabled, ...props }: {
  enabled: boolean; session: GameSession; seconds: number; listening: boolean; transcript: string; copy: GameCopy; children: ReactNode
}) {
  return enabled ? <LivingFireScene key={`${props.session.id}:${props.session.roundIndex}`} {...props} /> : <>{props.children}</>
}

export function TezGapirTranscript({ text }: { text: string }) {
  return <div className="tg-transcript-text" lang="ru">{text}</div>
}

function spokenWords(session: GameSession) {
  return session.history.reduce((total, turn) => total + (turn.feedback.answer.match(/\p{L}+(?:[-’']\p{L}+)*/gu)?.length ?? 0), 0)
}

export function TezGapirCelebration({ session, copy }: { session: GameSession; copy: GameCopy }) {
  return <div className="tg-celebration">
    <Campfire remaining={0} record={session.summary?.isNewBest} />
    <div className="tg-result-numbers"><div><strong>{spokenWords(session)}</strong><span>{copy.heard}</span></div><div><strong className="sg-score-big">{session.score}</strong><span>{copy.score}</span></div></div>
  </div>
}

export function TezGapirThanks({ character, copy }: { character: GameSession['character']; copy: GameCopy }) {
  const message = character === 'penguin' ? copy.tezPenguinThanks : character === 'panda' ? copy.tezPandaThanks : copy.tezPeroThanks
  return <div className="tg-thanks" data-character={character}>
    <TezGapirPortrait character={character} selected /><p>{message}</p>
  </div>
}

export function TezGapirShare({ session, copy }: { session: GameSession; copy: GameCopy }) {
  const [state, setState] = useState<'idle' | 'sharing' | 'copied' | 'manual'>('idle')
  const text = `Tez Gapir · ${copy.score}: ${session.score} · ${copy.heard}: ${spokenWords(session)}`
  const url = `${window.location.origin}/games/tez-gapir`
  async function share() {
    setState('sharing')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Tez Gapir', text, url })
        setState('idle')
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setState('copied')
      }
    } catch (error) {
      setState(error instanceof Error && error.name === 'AbortError' ? 'idle' : 'manual')
    }
  }
  return <><button className="tg-share" onClick={() => void share()} disabled={state === 'sharing'}>{state === 'copied' ? <Check size={17} /> : <Share2 size={17} />}{state === 'copied' ? copy.tezCopied : copy.tezShare}</button>
    {state === 'manual' && <label className="tg-share-fallback">{copy.tezCopyResult}<textarea readOnly value={`${text}\n${url}`} onFocus={(event) => event.target.select()} /></label>}
    <span className="sr-only" role="status">{state === 'copied' ? copy.tezCopied : ''}</span></>
}
