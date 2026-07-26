export type VoiceState = 'idle' | 'listening' | 'thinking' | 'feedback' | 'unavailable'

const BAR_COUNT = 7

const LABEL: Record<VoiceState, string> = {
  idle: 'Tayyor',
  listening: 'Tinglanmoqda',
  thinking: "O'ylanmoqda",
  feedback: 'Izoh tayyor',
  unavailable: 'Mavjud emas',
}

/**
 * Abstract audio-signal indicator. No emoji, no character, no expressive iconography —
 * just bars, a circle and a wave (PRD §7). Each state is named in text as well as drawn,
 * so it is never colour- or motion-only.
 */
export function VoiceSignal({ state, size = 'lg' }: { state: VoiceState; size?: 'sm' | 'lg' }) {
  const tone = {
    idle: 'bg-ink-faint',
    listening: 'bg-signal',
    thinking: 'bg-ink-muted',
    feedback: 'bg-milestone',
    unavailable: 'bg-ink-faint',
  }[state]

  const height = size === 'lg' ? 'h-14' : 'h-6'
  const width = size === 'lg' ? 'w-1.5' : 'w-1'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`flex items-center justify-center gap-1.5 ${height}`} aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <span
            key={index}
            className={`${width} h-full origin-center rounded-full ${tone}`}
            style={{
              // Motion only while the learner is actually being heard, so "listening" is
              // unmistakable and every other state stays calm.
              animation: state === 'listening' ? 'var(--animate-signal)' : undefined,
              animationDelay: `${index * 90}ms`,
              transform: state === 'listening' ? undefined : `scaleY(${0.25 + (index % 3) * 0.12})`,
              opacity: state === 'unavailable' ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      <p
        className="text-xs font-semibold tracking-[0.16em] text-ink-faint uppercase"
        role="status"
        aria-live="polite"
      >
        {LABEL[state]}
      </p>
    </div>
  )
}

/**
 * The compact circular badge that marks the phrase a learner is about to say. Decorative,
 * so it uses the bright brand blue — it carries no text, only a white glyph, which needs
 * 3:1 rather than 4.5:1.
 */
export function VoiceBadge({ state = 'idle' }: { state?: VoiceState }) {
  const isLive = state === 'listening'

  return (
    <span
      className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
        state === 'unavailable' ? 'bg-ink-faint' : 'bg-signal'
      }`}
      role="img"
      aria-label={LABEL[state]}
    >
      <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
        {[0.5, 1, 0.65].map((scale, index) => (
          <span
            key={index}
            /* Same flip as filled buttons: the glyph must clear 3:1 in both themes. */
            className="w-[3px] rounded-full bg-on-signal"
            style={{
              height: '100%',
              transform: isLive ? undefined : `scaleY(${scale})`,
              animation: isLive ? 'var(--animate-signal)' : undefined,
              animationDelay: `${index * 120}ms`,
            }}
          />
        ))}
      </span>
    </span>
  )
}
