import type { ReactNode } from 'react'
import { mascotImage } from '../../../lib/mascot-images'
import type { GameCopy, GameSlug } from './copy'
import './speaking-games.css'

export type Companion = 'penguin' | 'panda' | 'pero'
const companionImage = (companion: Companion) => mascotImage(companion)

export function GameMark({ game, className = '' }: { game: GameSlug; className?: string }) {
  return <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {game === 'tez-gapir' && <><path d="M15 30v20m10-32v44m10-38v32m10-44v56m10-47v38m10-29v20" /><circle cx="40" cy="40" r="34" opacity=".18" /></>}
    {game === 'error-hunt' && <><circle cx="34" cy="33" r="22" /><path d="m50 49 19 20M23 34l7 7 15-17" /><path d="M10 69h24" opacity=".3" /></>}
    {game === 'first-reaction' && <><path d="m43 7-25 36h20l-3 29 29-40H43z" /><path d="m12 10 5 7m48 43 7 5M7 50h6M62 14l7-5" opacity=".35" /></>}
    {game === 'ice-mystery' && <><path d="M9 68V35l13-11 13 11v33m0 0V20L49 8l13 12v48m0 0V39l10-8v37M5 68h70M16 43h9m18-17h11m-9 12h8M46 68V52h8v16" /><circle cx="23" cy="13" r="4" opacity=".4" /></>}
  </svg>
}

export function MicMark({ active }: { active?: boolean }) {
  return <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    {active ? <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" stroke="none" /> : <><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6" /></>}
  </svg>
}

export function Timer({ seconds, duration, label }: { seconds: number; duration: number; label: string }) {
  const fraction = Math.max(0, Math.min(1, seconds / duration))
  return <div className={`sg-timer ${seconds <= 3 ? 'sg-timer-urgent' : ''}`} role="timer" aria-label={`${Math.ceil(seconds)} ${label}`}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="44" strokeDasharray="276.46" strokeDashoffset={276.46 * (1 - fraction)} /></svg>
    <span><strong>{Math.ceil(seconds)}</strong><small>{label}</small></span>
  </div>
}

export function CompanionPicker({ value, onChange, copy, disabled = false }: { value: Companion; onChange: (value: Companion) => void; copy: GameCopy; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="sg-companions"><legend>{copy.character}</legend>
    {(['penguin', 'panda', 'pero'] as const).map((companion) => <button type="button" key={companion} aria-pressed={value === companion} onClick={() => onChange(companion)}>
      <img src={companionImage(companion)} alt="" /><span>{copy[companion === 'pero' ? 'feather' : companion]}</span>
    </button>)}
  </fieldset>
}

export function CharacterPortrait({ character }: { character: string }) {
  if (character === 'bear' || character === 'fox') return <svg viewBox="0 0 60 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-[70px] w-[58px] shrink-0 text-signal-ink">{character === 'fox' ? <path d="m12 28-1-18 19 10 19-10-1 18 4 15-22 16L8 43zm10 9h1m14 0h1m-11 9h6" /> : <><circle cx="15" cy="18" r="8" /><circle cx="45" cy="18" r="8" /><circle cx="30" cy="35" r="23" /><path d="M20 31h1m18 0h1m-13 9h6m-3 0v6m-6 0q6 5 12 0" /></>}</svg>
  return <img src={companionImage(character === 'panda' ? 'panda' : character === 'pero' || character === 'feather' ? 'pero' : 'penguin')} alt="" />
}

export function CharacterNote({ companion, children }: { companion: string; children: ReactNode }) {
  return <div className="sg-character-note"><CharacterPortrait character={companion} /><div lang="ru">{children}</div></div>
}

export function ReactionScene({ text }: { text: string }) {
  const animal = /слон|кот|кошка|собака|тигр|пингвин|животн/.test(text.toLowerCase())
  const money = /миллион|деньг|богат|подар|выигр|зарплат/.test(text.toLowerCase())
  const travel = /самол|летать|лун|космо|поезд|машин|путешеств/.test(text.toLowerCase())
  return <div className="sg-reaction-scene" aria-hidden="true"><svg viewBox="0 0 320 150" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="160" cy="80" r="63" fill="currentColor" opacity=".07" stroke="none" /><path d="M70 132h180" opacity=".2" />
    {animal ? <g className="sg-scene-float"><path d="M116 113V76c0-34 66-41 78-4v40l-13 3V91l-15 1v23h-17V93h-16v22z" fill="currentColor" fillOpacity=".12" /><path d="M193 74c18-9 30 0 31 15v25c0 14-18 14-18 0m-82-44c-12 3-13 15-10 23" /><circle cx="195" cy="83" r="2" fill="currentColor" /><path d="M177 71c-24-18-35 25-13 27" /></g>
      : money ? <g className="sg-scene-float"><rect x="108" y="58" width="105" height="63" rx="8" transform="rotate(-8 160 90)" fill="currentColor" fillOpacity=".1" /><circle cx="160" cy="90" r="18" /><path d="M154 84h10l-10 13h10m-41-12h3m68-1h3m-76-48 4 9m41-18v10m34-6-5 9" /><circle cx="205" cy="40" r="8" /></g>
        : travel ? <g className="sg-scene-float"><path d="m103 88 108-40-39 74-17-29z" fill="currentColor" fillOpacity=".12" /><path d="m155 93 56-45m-61 60-18 14 6-23m-33 12H88m18-43H86" /><circle cx="223" cy="93" r="11" opacity=".3" /></g>
          : <g className="sg-scene-float"><path d="M114 94c-36-40 12-81 47-43 32-38 80 3 45 43l-45 36z" fill="currentColor" fillOpacity=".12" /><path d="M144 75c2 7 8 7 10 0m16 0c2 7 8 7 10 0m-31 20q12 10 25 0m-76-55-5-8m131 7 6-7" /><circle cx="233" cy="72" r="4" /></g>}
  </svg></div>
}
