import { useId, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { AudioLines, Sparkles, Trophy } from 'lucide-react'
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

export function TezGapirScene({ enabled, session, seconds, listening, timer, copy, children }: {
  enabled: boolean; session: GameSession; seconds: number; listening: boolean; timer: ReactNode; copy: GameCopy; children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return <div className="tg-scene" data-character={session.character} data-listening={listening}>
    <div className="tg-countdown" data-tone={seconds <= 5 ? 'urgent' : seconds <= 15 ? 'warning' : 'calm'}>{timer}</div>
    <div className="tg-mentor">
      <div className="tg-mentor-orbit" aria-hidden="true" />
      <img src={`/games/characters/${session.character}.webp`} alt="" width="512" height="512" />
      <span>{copy[session.character === 'pero' ? 'feather' : session.character]}</span>
    </div>
    <div className="tg-topic" key={session.prompt.id}>
      <span className="tg-eyebrow"><AudioLines size={16} aria-hidden="true" />{session.prompt.kind === 'ready' ? copy.microphone : copy.theme}</span>
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

export function TezGapirCelebration() {
  return <div className="tg-celebration" aria-hidden="true">
    <div className="tg-trophy"><Trophy size={42} strokeWidth={1.8} /></div>
    {Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--tg-i': index } as CSSProperties} />)}
  </div>
}
