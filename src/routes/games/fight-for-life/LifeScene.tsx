import type { CSSProperties } from 'react'
import { Flower2, Music2, Sparkles } from 'lucide-react'
import type { LifeCharacter } from './api'
import type { LifeEmotion } from './meter'

export function LifeScene({ character, emotion = 'idle', energy = 1, volume = 0, compact = false }: {
  character: LifeCharacter; emotion?: LifeEmotion; energy?: number; volume?: number; compact?: boolean
}) {
  const pose = emotion === 'speaking' || emotion === 'won' ? 1 : emotion === 'waiting' ? 2 : emotion === 'cold' || emotion === 'frozen' ? 3 : 0
  const Particle = character === 'penguin' ? Music2 : character === 'panda' ? Flower2 : Sparkles
  return <div className={`life-scene${compact ? ' life-scene-compact' : ''}`} data-character={character} data-emotion={emotion}
    style={{ '--life-energy': energy, '--life-volume': volume } as CSSProperties} aria-hidden="true">
    <div className="life-aura"><i /><i /><i /></div>
    {!compact && <div className="life-equalizers">{[0, 1].map(side => <div key={side}>{Array.from({ length: 9 }, (_, i) =>
      <i key={i} style={{ '--bar': (i * 7 % 9 + 2) / 10, '--i': i } as CSSProperties} />)}</div>)}</div>}
    <div className="life-ground" />
    <div className="life-puppet">
      {[0, 1, 2, 3].map(i => <div key={i} className="life-pose" data-active={pose === i} style={{
        backgroundImage: `url(/games/fight-for-life/characters/${character}-poses.webp)`,
        backgroundPosition: `${i % 2 * 100}% ${Math.floor(i / 2) * 100}%`,
      }} />)}
    </div>
    {character === 'panda' && <div className="life-steam"><i /><i /><i /></div>}
    <div className="life-particles">{Array.from({ length: 7 }, (_, i) => <Particle key={i} style={{ '--i': i, left: `${7 + i * 27 % 85}%`, top: `${10 + i * 23 % 70}%` } as CSSProperties} />)}</div>
    <div className="life-frost" />
    {emotion === 'frozen' && character === 'pero' && <div className="life-pixels">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--i': i, left: `${i * 17 % 100}%`, top: `${i * 23 % 100}%` } as CSSProperties} />)}</div>}
  </div>
}
