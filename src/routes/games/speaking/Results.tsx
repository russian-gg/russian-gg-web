import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui'
import { speakingGames, type GameDashboard, type GameFeedback, type GameSession, type LeaderboardEntry } from '../../../lib/speaking-games'
import type { GameCopy, GameSlug } from './copy'
import { CharacterNote } from './visuals'

export function Feedback({ feedback, copy, hideExplanation = false }: { feedback: GameFeedback; copy: GameCopy; hideExplanation?: boolean }) {
  const names: Record<string, string> = { speed: copy.speed, fast: copy.speed, relevance: copy.relevance, relevant: copy.relevance, grammar: copy.grammar, emotion: copy.emotion, emotional: copy.emotion, bonus: copy.bonus, lesson: copy.lessonBonus }
  return <section className="sg-feedback" aria-label={copy.review}>
    <h2>{copy.answer}</h2><p lang="ru">{feedback.answer || copy.noAnswer}</p>
    {feedback.correctAnswer && <><h2 className="mt-5">{copy.correct}</h2><p lang="ru">{feedback.correctAnswer}</p></>}
    {feedback.explanation && !hideExplanation && <><h2 className="mt-5">{copy.explanation}</h2><p lang="ru">{feedback.explanation}</p></>}
    <div className="sg-criteria">{feedback.criteria.map((criterion, index) => <span key={`${criterion.code}-${index}`} className="sg-chip" data-positive={criterion.passed}>
      {names[criterion.code] ?? criterion.label} <strong>{criterion.points > 0 ? '+' : ''}{criterion.points}</strong>
    </span>)}</div>
    {feedback.words.length > 0 && <div className="sg-criteria" aria-label={copy.heard}>{feedback.words.map((word, index) => <span lang="ru" key={`${index}-${word.text}`} className="sg-chip" data-positive={word.points > 0} title={`${word.category}: ${word.points}`}>
      {word.text}<strong>{word.points > 0 ? '+' : ''}{word.points}</strong>
    </span>)}</div>}
    <p className="mt-4 text-right font-extrabold">{copy.score}: {feedback.points > 0 ? '+' : ''}{feedback.points}</p>
  </section>
}

export function City({ points, objects, copy }: { points: number; objects: string[]; copy: GameCopy }) {
  return <section className="sg-city"><h2>{copy.city}</h2>
    <div className="sg-cityscape" aria-hidden="true">{objects.slice(0, 18).map((object, i) => <svg key={`${object}-${i}`} viewBox="0 0 60 85" width="48" height="85" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {object.includes(':tree:') ? <><path d="M30 79V48m0 13-12-12m12 5 12-9" /><path d="M13 49c-17-18 0-44 17-39 23-6 34 21 19 37-3 17-31 20-36 2" fill="currentColor" fillOpacity=".12" /></>
        : object.includes(':bench:') ? <><path d="M8 40h44v20H8zm-3 24h50M12 64v16m36-16v16M8 48h44" /></>
          : object.includes(':fountain:') ? <><path d="M7 59q23 38 46 0zM14 80h32M30 59V20m0 24C12 22 7 36 13 48m17-14c18-19 26-1 14 8" /><circle cx="30" cy="15" r="3" /></>
            : object.includes(':lamp:') ? <><path d="M22 80h16M30 80V32M21 10h18l5 20H16zm-3 8h24M30 10V4" fill="currentColor" fillOpacity=".08" /></>
              : <><path d="M5 80h50M10 80V32L30 17l20 15v48M23 80V60h14v20M18 40h5v7h-5zm19 0h5v7h-5z" fill="currentColor" fillOpacity=".08" /><circle cx="30" cy="9" r="5" /></>}
    </svg>)}</div>
    <p className="sg-muted">{copy.total}: <strong>{points}</strong></p>
    {objects.includes('detective-agency') && <p className="mt-2 text-sm font-bold">{copy.detective}</p>}
  </section>
}

export function Results({ session, copy, onAgain }: { session: GameSession; copy: GameCopy; onAgain: () => void }) {
  const summary = session.summary
  return <div className="sg-board">
    <p className="sg-muted">{copy.saved}</p>
    <h1 className="sg-prompt">{summary?.won === true ? copy.solved : summary?.won === false ? copy.unsolved : copy.completed}</h1>
    <div className="sg-score-big">{session.score}</div><p className="sg-muted">{copy.score}</p>
    {summary?.isNewBest && <p className="mt-4 font-extrabold text-milestone">{copy.record}</p>}
    <div className="sg-stat-grid"><div><strong>{summary?.bestScore ?? session.score}</strong><small>{copy.best}</small></div><div><strong>{summary?.roundsPlayed ?? session.history.length}</strong><small>{copy.rounds}</small></div><div><strong>+{summary?.rewardPoints ?? 0}</strong><small>{copy.bonus}</small></div></div>
    {session.feedback?.characterPhrase && <CharacterNote companion={session.character}>{session.feedback.characterPhrase}</CharacterNote>}
    <div className="sg-actions"><Button onClick={onAgain} size="lg">{copy.again}</Button></div>
    {session.achievements.length > 0 && <section className="mt-8 text-left"><h2 className="text-base font-extrabold">{copy.achievements}</h2><div className="sg-achievements">{session.achievements.map((achievement) => <span key={achievement.code} lang="ru">{achievement.titleRu} +{achievement.reward}</span>)}</div></section>}
    {summary && <City points={summary.cityPoints} objects={summary.cityObjects} copy={copy} />}
    <section className="mt-8 text-left"><h2 className="text-xl font-extrabold">{copy.review}</h2>{session.history.map((turn, index) => <details key={`${turn.roundIndex}-${index}`} className="mt-3 rounded-2xl border border-hairline p-4"><summary className="cursor-pointer text-sm font-bold" lang="ru">{turn.prompt.textRu} <span className="ml-2">{turn.feedback.points > 0 ? '+' : ''}{turn.feedback.points}</span></summary><Feedback feedback={turn.feedback} copy={copy} /></details>)}</section>
  </div>
}

export function Statistics({ slug, copy, dashboard }: { slug: GameSlug; copy: GameCopy; dashboard: GameDashboard | null }) {
  const [tab, setTab] = useState<'weekly' | 'all' | 'progress'>('weekly')
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (tab === 'progress') return
    let active = true
    setFailed(false)
    setEntries(null)
    void speakingGames.leaderboard(slug, tab === 'weekly').then((rows) => { if (active) setEntries(rows) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [slug, tab, retry])
  return <section className="mt-12">
    <div className="sg-tabs" role="tablist" aria-label={copy.progress}>{(['weekly', 'all', 'progress'] as const).map((name) => <button key={name} type="button" id={`sg-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`sg-panel-${name}`} onClick={() => setTab(name)}>{name === 'weekly' ? copy.weekly : name === 'all' ? copy.allTime : copy.progress}</button>)}</div>
    <div role="tabpanel" id={`sg-panel-${tab}`} aria-labelledby={`sg-tab-${tab}`}>
      {tab === 'progress' && dashboard ? <><City points={dashboard.cityPoints} objects={dashboard.cityObjects} copy={copy} /><div className="sg-achievements">{dashboard.achievements.map((achievement) => <span key={achievement.code} lang="ru">{achievement.titleRu} +{achievement.reward}</span>)}</div><p className="sg-muted">{copy.best}: {dashboard.bestScores[slug] ?? 0}</p><section className="mt-6"><h2 className="text-base font-extrabold">{copy.daily}</h2>{dashboard.dailyChallenges?.filter((goal) => goal.gameSlug === slug).map((goal) => <div key={goal.gameSlug} className="sg-city"><p className="text-sm font-bold">{copy.rounds}: {Math.min(goal.completed, goal.target)} / {goal.target} <span className="float-right">+{goal.reward}</span></p><progress className="mt-3 w-full accent-signal" value={Math.min(goal.completed, goal.target)} max={goal.target} aria-label={copy.daily} /></div>)}</section></> : tab !== 'progress' && <>
        {failed ? <div className="sg-error" role="alert">{copy.error}<button onClick={() => setRetry((n) => n + 1)}>{copy.retry}</button></div> : entries === null ? <p className="sg-muted py-8">{copy.loading}</p> : entries.length === 0 ? <p className="sg-muted py-8">{copy.empty}</p> : <table className="sg-table"><thead><tr><th scope="col">{copy.rank}</th><th scope="col">{copy.player}</th><th scope="col">{copy.score}</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.rank} className={entry.isCurrentUser ? 'bg-signal-soft' : ''}><td>{entry.rank}</td><td>{entry.displayName}</td><td>{entry.score}</td></tr>)}</tbody></table>}
      </>}
    </div>
  </section>
}
