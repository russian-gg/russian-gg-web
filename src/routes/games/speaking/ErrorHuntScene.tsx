import { Check, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { GameFeedback, GameSession } from '../../../lib/speaking-games'
import type { GameCopy } from './copy'
import './error-hunt.css'

function resultTone(feedback?: GameFeedback | null) {
  if (!feedback) return 'pending'
  if (!feedback.answer.trim()) return 'unanswered'
  return feedback.correct ? 'correct' : 'review'
}

export function ErrorHuntScene({ enabled, session, seconds, timer, children }: {
  enabled: boolean; session: GameSession; seconds: number; timer: ReactNode; children: ReactNode
}) {
  if (!enabled) return <>{timer}{children}</>
  return <div className="eh-scene" data-result={resultTone(session.feedback)} data-ready={session.prompt.kind === 'ready'}>
    <div className="eh-stage-grid" aria-hidden="true" />
    <div className="eh-countdown" data-tone={seconds <= 3 ? 'urgent' : seconds <= 6 ? 'warning' : 'calm'}>{timer}</div>
    <div className="eh-mascot" aria-hidden="true">
      <img src={`/games/error-hunt/characters/${session.character}.webp`} alt="" width="512" height="512" />
    </div>
    <div className="eh-hologram" key={session.prompt.id}>
      <span className="eh-signal" aria-hidden="true"><i /><i /><i /></span>
      {children}
      <span className="eh-scan-line" aria-hidden="true" />
    </div>
  </div>
}

export function ErrorHuntProgress({ session, copy }: { session: GameSession; copy: GameCopy }) {
  return <ol className="eh-rounds" aria-label={copy.rounds}>
    {Array.from({ length: session.totalRounds }, (_, index) => {
      const feedback = session.history.find((turn) => turn.roundIndex === index)?.feedback
      const tone = resultTone(feedback)
      return <li key={index} data-result={tone} aria-current={index === session.roundIndex ? 'step' : undefined}>
        <span className="eh-round-number">{index + 1}</span>
        <span className="eh-round-track" aria-hidden="true">{tone === 'correct' ? <Check size={15} /> : tone === 'unanswered' ? <Minus size={15} /> : tone === 'review' ? '!' : null}</span>
        <span className="sr-only">{tone === 'correct' ? copy.correct : tone === 'unanswered' ? copy.noAnswer : tone === 'review' ? copy.review : ''}</span>
      </li>
    })}
  </ol>
}
