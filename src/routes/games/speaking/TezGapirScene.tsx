import { useId, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { AudioLines, Sparkles } from 'lucide-react'
import type { Select } from '../../../components/forms/Select'
import type { GameSession } from '../../../lib/speaking-games'
import type { GameCopy } from './copy'
import './tez-gapir.css'

export function TezGapirLevelPicker({ value, onChange, options, label, disabled }: ComponentProps<typeof Select>) {
  const name = useId()
  return <fieldset className="tg-levels" role="radiogroup" aria-label={label} disabled={disabled}>
    {options.filter((option) => option.value).map((option) => <label key={option.value} data-level={option.value} data-selected={value === option.value}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
      <span className="tg-level-dot" aria-hidden="true" /><strong>{option.label}</strong>
    </label>)}
  </fieldset>
}

export function TezGapirBackdrop() {
  return <div className="tg-backdrop" aria-hidden="true">
    {['А', 'Б', 'В', 'Г', 'Д', 'Я'].map((letter, index) => <span key={letter} style={{ '--tg-i': index } as CSSProperties}>{letter}</span>)}
    <Sparkles className="tg-spark tg-spark-one" /><Sparkles className="tg-spark tg-spark-two" />
  </div>
}

function TezGapirStarTimer({ session, seconds, copy }: { session: GameSession; seconds: number; copy: GameCopy }) {
  const gradient = useId()
  const [lastActiveSeconds, setLastActiveSeconds] = useState(() => {
    const turn = session.history.find((entry) => entry.roundIndex === session.roundIndex)
    if (session.status !== 'feedback' || !session.roundStartedAt || !turn) return seconds
    const elapsed = (Date.parse(turn.answeredAt) - Date.parse(session.roundStartedAt)) / 1000
    return Number.isFinite(elapsed) ? Math.max(0, Math.min(session.durationSeconds, session.durationSeconds - elapsed)) : seconds
  })
  if (session.status === 'answering' && lastActiveSeconds !== seconds) setLastActiveSeconds(seconds)
  const displayedSeconds = session.status === 'feedback' ? lastActiveSeconds : seconds
  const remaining = Math.max(0, Math.min(1, displayedSeconds / Math.max(1, session.durationSeconds)))
  const progress = 1 - remaining
  const star = 'M110 14 138 76 206 84 156 132 170 202 110 166 50 202 64 132 14 84 82 76Z'
  return <div className="tg-timer-scene">
    <div className="tg-mentor">
      <img src={`/games/characters/${session.character}.webp`} alt="" width="512" height="512" />
      <span className="tg-mentor-name">{copy[session.character === 'pero' ? 'feather' : session.character]}</span>
    </div>
    <div className="tg-star-timer" role="timer" aria-label={`${Math.ceil(displayedSeconds)} ${copy.seconds}`} data-finished={remaining === 0} style={{
      '--tg-star-glow': `${6 + progress * 28}px`,
      '--tg-star-aura': .15 + progress * .6,
      '--tg-star-rays': .08 + progress * .62,
      '--tg-star-brightness': 1 + progress * .18,
    } as CSSProperties}>
      <div className="tg-star-rays" aria-hidden="true" />
      <svg className="tg-star-shape" viewBox="0 0 220 220" aria-hidden="true">
        <defs><radialGradient id={gradient} cx="44%" cy="38%" r="70%">
          <stop stopColor="#fffbe0" /><stop offset=".45" stopColor="#ffe879" /><stop offset="1" stopColor="#ffb82e" />
        </radialGradient></defs>
        <path className="tg-star-halo" d={star} />
        <path className="tg-star-body" d={star} fill={`url(#${gradient})`} />
        <path d="m110 31 22 51 55 7" fill="none" stroke="#fffdf0" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      </svg>
      <div className="tg-star-twinkles" aria-hidden="true">{[[18, 22], [82, 18], [90, 62], [15, 78]].map(([left, top], index) => <i key={index} style={{ left: `${left}%`, top: `${top}%`, '--tg-delay': `${index * -.65}s` } as CSSProperties} />)}</div>
      <span className="tg-star-time"><strong>{Math.ceil(displayedSeconds)}</strong><small>{copy.seconds}</small></span>
    </div>
  </div>
}

export function TezGapirScene({ enabled, session, seconds, listening, copy, children }: {
  enabled: boolean; session: GameSession; seconds: number; listening: boolean; copy: GameCopy; children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return <div className="tg-scene" data-character={session.character} data-listening={listening}>
    <TezGapirStarTimer key={`${session.id}:${session.roundIndex}`} session={session} seconds={seconds} copy={copy} />
    <div className="tg-topic" key={session.prompt.id}>
      {session.prompt.kind !== 'ready' && <span className="tg-eyebrow"><AudioLines size={16} aria-hidden="true" />{copy.theme}</span>}
      {children}
      <div className="tg-wave" aria-hidden="true">
        {[14, 24, 38, 20, 46, 30, 18, 36, 48, 26, 16, 32, 22, 12, 24].map((height, index) => <i key={index} style={{ '--tg-bar': `${height}px`, '--tg-delay': `${index * -0.11}s` } as CSSProperties} />)}
      </div>
    </div>
  </div>
}

export function TezGapirTranscript({ text }: { text: string }) {
  return <div className="tg-word-wave" lang="ru">
    {text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : <span className="tg-word" key={`${index}-${word}`}>{word}</span>)}
  </div>
}

export function TezGapirCelebration({ score, label }: { score: number; label: string }) {
  const gold = useId()
  return <div className="tg-celebration">
    <div className="tg-trophy" role="img" aria-label={`${label}: ${score}`}>
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <defs><linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff4ad" /><stop offset=".35" stopColor="#ffda55" /><stop offset=".7" stopColor="#e9a524" /><stop offset="1" stopColor="#fff09a" />
        </linearGradient></defs>
        <path d="M64 48H30v24c0 32 21 50 49 50M176 48h34v24c0 32-21 50-49 50" fill="none" stroke="#f1be46" strokeWidth="11" strokeLinejoin="round" />
        <path d="M111 143h18v49h-18zM91 192h58l10 17H81zM75 209h90v17H75z" fill={`url(#${gold})`} stroke="#ffe894" strokeWidth="2" strokeLinejoin="round" />
        <path d="M62 26h116v68a58 58 0 0 1-116 0Z" fill={`url(#${gold})`} stroke="#fff0a3" strokeWidth="3" />
        <path d="M73 39v52c0 18 7 30 18 39" fill="none" stroke="#fff8d4" strokeWidth="5" strokeLinecap="round" opacity=".6" />
      </svg>
      <strong className="sg-score-big" aria-hidden="true" style={{ fontSize: `${Math.min(52, 190 / String(score).length)}px` }}>{score}</strong>
    </div>
    {Array.from({ length: 14 }, (_, index) => <i key={index} aria-hidden="true" style={{ '--tg-i': index } as CSSProperties} />)}
  </div>
}

export function TezGapirThanks({ character, copy }: { character: GameSession['character']; copy: GameCopy }) {
  const message = character === 'penguin' ? copy.tezPenguinThanks : character === 'panda' ? copy.tezPandaThanks : copy.tezPeroThanks
  return <div className="tg-thanks" data-character={character}>
    <div className="tg-happy-character" aria-hidden="true">
      <Sparkles className="tg-happy-spark" size={25} />
      <img src={`/games/characters/${character}.webp`} alt="" width="512" height="512" />
      <Sparkles className="tg-happy-spark" size={18} />
    </div>
    <p>{message}</p>
  </div>
}
