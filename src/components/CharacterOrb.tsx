import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * What the orb is doing, in the vocabulary the ElevenLabs UI orb uses. Keeping the prop shape
 * identical means their WebGL component can replace this one later without touching callers:
 * the mission screen passes colours, a state and two volumes, and nothing else.
 */
export type OrbState = 'idle' | 'listening' | 'talking' | 'thinking'

type CharacterOrbProps = {
  /** [light, deep] — the character's own colours. */
  colors: [string, string]
  agentState: OrbState
  /** 0–1. How loudly the learner is speaking. */
  manualInput?: number
  /** 0–1. How loudly the character is speaking. */
  manualOutput?: number
  /** Accessible description; the state is never conveyed by colour alone. */
  label: string
}

/**
 * The sphere a learner talks to.
 *
 * Drawn with layered gradients rather than WebGL: a lesson runs on a mid-range Android phone
 * over a mobile connection, and 600KB of three.js buys an effect that has to survive being
 * watched for five minutes without draining the battery. It reacts to real audio levels, so
 * the learner can see they are being heard.
 */
export function CharacterOrb({
  colors,
  agentState,
  manualInput = 0,
  manualOutput = 0,
  label,
}: CharacterOrbProps) {
  const [light, deep] = colors
  const level = agentState === 'talking' ? manualOutput : manualInput
  const smoothed = useSmoothed(level, agentState)

  const style = {
    '--orb-light': light,
    '--orb-deep': deep,
    '--orb-level': smoothed.toFixed(3),
  } as CSSProperties

  return (
    <div className={`orb orb-${agentState}`} style={style} role="img" aria-label={label}>
      <span className="orb-halo" aria-hidden="true" />
      <span className="orb-ring" aria-hidden="true" />
      <span className="orb-ring orb-ring-late" aria-hidden="true" />
      <span className="orb-body" aria-hidden="true">
        <span className="orb-sheen" />
        <span className="orb-core" />
      </span>
      <style>{ORB_STYLES}</style>
    </div>
  )
}

/**
 * Audio levels arrive as a jagged stream; following them exactly makes the sphere jitter.
 * This eases toward the newest value and decays when nobody is speaking, which is what makes
 * the movement read as breathing rather than as noise.
 */
function useSmoothed(level: number, state: OrbState) {
  const [value, setValue] = useState(0)
  const target = useRef(0)
  const frame = useRef<number | undefined>(undefined)

  target.current = state === 'thinking' ? 0 : Math.max(0, Math.min(1, level))

  useEffect(() => {
    let current = 0
    const tick = () => {
      const goal = target.current
      current += (goal - current) * (goal > current ? 0.35 : 0.12)
      setValue(Math.round(current * 1000) / 1000)
      frame.current = window.requestAnimationFrame(tick)
    }

    frame.current = window.requestAnimationFrame(tick)
    return () => {
      if (frame.current !== undefined) window.cancelAnimationFrame(frame.current)
    }
  }, [])

  return value
}

const ORB_STYLES = `
  .orb{position:relative;display:grid;place-items:center;width:min(62vw,17rem);aspect-ratio:1}
  .orb-body{position:relative;display:block;width:72%;aspect-ratio:1;border-radius:50%;
    background:
      radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--orb-light) 92%, #fff) 0%, var(--orb-light) 38%, var(--orb-deep) 100%);
    box-shadow:0 18px 50px -12px color-mix(in srgb, var(--orb-deep) 60%, transparent),
      inset 0 -18px 34px -16px color-mix(in srgb, var(--orb-deep) 85%, #000);
    transform:scale(calc(1 + var(--orb-level) * 0.12));
    transition:transform .08s linear}
  .orb-sheen{position:absolute;inset:6% 6% 42% 12%;border-radius:50%;
    background:radial-gradient(circle at 34% 24%, rgba(255,255,255,.75), rgba(255,255,255,0) 62%)}
  .orb-core{position:absolute;inset:26%;border-radius:50%;
    background:radial-gradient(circle, color-mix(in srgb, #fff 70%, var(--orb-light)) 0%, transparent 70%);
    opacity:calc(.25 + var(--orb-level) * .55)}
  .orb-halo{position:absolute;inset:0;border-radius:50%;
    background:radial-gradient(circle, color-mix(in srgb, var(--orb-light) 55%, transparent) 0%, transparent 62%);
    filter:blur(14px);opacity:calc(.35 + var(--orb-level) * .5);
    transform:scale(calc(1 + var(--orb-level) * .18));transition:transform .12s linear}
  .orb-ring{position:absolute;width:78%;aspect-ratio:1;border-radius:50%;
    border:2px solid color-mix(in srgb, var(--orb-light) 70%, transparent);opacity:0}
  .orb-listening .orb-ring{animation:orb-pulse 2.4s ease-out infinite}
  .orb-listening .orb-ring-late{animation-delay:1.2s}
  .orb-talking .orb-body{animation:orb-speak 1.6s ease-in-out infinite}
  .orb-thinking .orb-body{animation:orb-think 3.2s ease-in-out infinite}
  .orb-idle .orb-body{animation:orb-breathe 5s ease-in-out infinite}
  @keyframes orb-pulse{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.45)}}
  @keyframes orb-speak{0%,100%{filter:saturate(1)}50%{filter:saturate(1.18) brightness(1.06)}}
  @keyframes orb-think{0%,100%{filter:saturate(.7) brightness(.96)}50%{filter:saturate(.85)}}
  @keyframes orb-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
  @media(prefers-reduced-motion:reduce){
    .orb-ring,.orb-body{animation:none!important}
    .orb-body,.orb-halo{transition:none}
  }
`
