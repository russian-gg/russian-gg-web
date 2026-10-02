import { useEffect, useId, useState } from 'react'
import { CountUp } from '../../components/motion'

/**
 * The share of all questions answered correctly, as a ring. The arc draws itself in and the
 * figure counts up beside it — a CSS transition rather than Motion, so the stylesheet's
 * reduced-motion rule stills it with everything else.
 */
export function ResultRing({ percent, label }: { percent: number; label: string }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const arc = (Math.min(100, Math.max(0, percent)) / 100) * circumference
  const [drawn, setDrawn] = useState(false)
  // Its own id: two rings on one screen must not share a gradient.
  const gradientId = useId()

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div role="img" aria-label={`${label}: ${percent}%`} className="relative grid size-36 shrink-0 place-items-center">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-signal-depth)" />
            <stop offset="100%" stopColor="var(--color-signal)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-signal-soft)" strokeWidth="11" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${drawn ? arc : 0} ${circumference}`}
          className="transition-[stroke-dasharray] delay-200 duration-1000 ease-out"
        />
      </svg>
      <span className="absolute grid place-items-center text-center">
        <span className="text-2xl leading-none font-extrabold text-ink tabular-nums">
          <CountUp value={percent} />%
        </span>
        <span className="mt-1 max-w-16 text-xs leading-tight text-ink-muted">{label}</span>
      </span>
    </div>
  )
}
