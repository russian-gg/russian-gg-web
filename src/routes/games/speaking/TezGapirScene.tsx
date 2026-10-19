import { useId, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
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

function TezGapirFireTimer({ session, seconds, copy }: { session: GameSession; seconds: number; copy: GameCopy }) {
  const gradient = useId()
  const remaining = Math.max(0, Math.min(1, seconds / Math.max(1, session.durationSeconds)))
  const star = 'M110 12 Q123 53 138 75 Q174 75 207 84 Q182 111 156 132 Q168 167 170 202 Q136 184 110 165 Q82 187 50 202 Q53 166 64 132 Q36 112 13 84 Q49 76 82 75 Q98 45 110 12Z'
  return <div className="tg-fire-mentor">
    <div className="tg-fire-timer" role="timer" aria-label={`${Math.ceil(seconds)} ${copy.seconds}`} data-running={session.status === 'answering'} style={{ '--tg-heat': 5 + remaining * 50, '--tg-fire-speed': `${.7 + remaining * .7}s` } as CSSProperties}>
      <svg className="tg-fire-shape" viewBox="0 0 220 220" aria-hidden="true">
        <defs><radialGradient id={gradient} cx="50%" cy="48%" r="60%">
          <stop offset="0" stopColor="#11162f" /><stop offset=".48" stopColor="#251b27" />
          <stop offset=".76" stopColor="hsl(var(--tg-heat) 100% 52%)" /><stop offset="1" stopColor="hsl(var(--tg-heat) 100% 68%)" />
        </radialGradient></defs>
        <path className="tg-fire-halo" d={star} />
        <path className="tg-fire-body" d={star} fill={`url(#${gradient})`} />
        <g className="tg-fire-tongues">
          <path d="M94 55C88 34 111 25 106 2C128 20 111 38 126 53C114 44 111 34 112 27C103 39 108 48 94 55Z" />
          <path d="M37 105C12 107 24 84 4 68C31 73 28 91 49 91C35 94 29 87 23 83C26 94 24 98 37 105Z" />
          <path d="M179 102C196 89 183 73 210 59C201 80 224 91 200 110C205 98 201 92 198 87C194 99 186 103 179 102Z" />
          <path d="M58 162C44 175 49 196 31 215C56 208 65 190 61 180C57 190 52 194 48 196C55 183 52 175 58 162Z" />
          <path d="M160 164C175 172 169 194 190 210C166 206 155 192 159 180C162 190 168 193 174 195C166 183 168 173 160 164Z" />
        </g>
      </svg>
      <img className="tg-fire-character" src={`/games/characters/${session.character}.webp`} alt="" width="512" height="512" />
      <div className="tg-fire-sparks" aria-hidden="true">{[18, 78, 35, 87, 10, 64, 43, 94].map((left, index) => <i key={index} style={{ '--tg-x': `${left}%`, '--tg-y': `${28 + index % 4 * 16}%`, '--tg-drift': `${index % 2 ? 16 : -16}px`, '--tg-delay': `${index * -.23}s` } as CSSProperties} />)}</div>
      <span className="tg-fire-time"><strong>{Math.ceil(seconds)}</strong><small>{copy.seconds}</small></span>
    </div>
    <span className="tg-fire-name">{copy[session.character === 'pero' ? 'feather' : session.character]}</span>
  </div>
}

export function TezGapirScene({ enabled, session, seconds, listening, copy, children }: {
  enabled: boolean; session: GameSession; seconds: number; listening: boolean; copy: GameCopy; children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return <div className="tg-scene" data-character={session.character} data-listening={listening}>
    <TezGapirFireTimer session={session} seconds={seconds} copy={copy} />
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
