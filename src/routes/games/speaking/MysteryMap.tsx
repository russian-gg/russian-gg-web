import type { GameSession } from '../../../lib/speaking-games'
import type { GameCopy } from './copy'
import { CharacterPortrait } from './visuals'

export function MysteryMap({ session, copy, busy, visit, accuse }: { session: GameSession; copy: GameCopy; busy: boolean; visit: (id: string) => void; accuse: () => void }) {
  return <div className="sg-mystery"><section>
    <h2 className="mb-4 text-xl font-extrabold">{copy.map}</h2>
    <div className="sg-map">{session.locations.map((location) => <button key={location.id} disabled={busy || location.questionsAsked >= location.maxQuestions} onClick={() => visit(location.id)} aria-label={`${location.titleRu}: ${copy.enter}`}>
      <CharacterPortrait character={location.character} />
      <strong lang="ru">{location.titleRu}</strong><small>{copy.questions}: {location.questionsAsked}/{location.maxQuestions}</small>{location.visited && <small className="text-milestone">✓ {copy.investigated}</small>}
    </button>)}</div>
    <button type="button" className="mt-5 w-full rounded-2xl bg-signal px-5 py-4 font-extrabold text-on-signal disabled:opacity-40" disabled={busy || !session.locations.every((l) => l.visited)} onClick={accuse}>{copy.accuse}</button>
  </section><Evidence session={session} copy={copy} /></div>
}

export function Evidence({ session, copy }: { session: GameSession; copy: GameCopy }) {
  return <aside className="sg-journal"><h2>{copy.clues} <span className="text-signal-ink">{session.clues.length}/5</span></h2>{session.clues.length ? <ol>{session.clues.map((clue) => <li lang="ru" key={clue.id}>{clue.textRu}</li>)}</ol> : <p className="sg-muted">{copy.noClues}</p>}</aside>
}
