import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, Spinner } from '../../../components/ui'
import { RequestError } from '../../../lib/api'
import { useLocale } from '../../../lib/i18n'
import { readAudioPreferences } from '../../../lib/audio-preferences'
import { GameSpeech, type GameSpeechStatus } from '../../../lib/game-speech'
import { speakingGames, type GameAnswer, type GameDashboard, type GameSession, type SpeakingGame, type StartGame } from '../../../lib/speaking-games'
import { copies, gameLabels, isSpeakingGame, type GameSlug } from './copy'
import { CharacterNote, CompanionPicker, GameMark, MicMark, ReactionScene, Timer, type Companion } from './visuals'
import { Feedback, Results, Statistics } from './Results'
import { Evidence, MysteryMap } from './MysteryMap'

export function SpeakingGamePage() {
  const { slug } = useParams()
  const { locale } = useLocale()
  if (!slug || !isSpeakingGame(slug)) return <div className="sg"><Link to="/games">{copies[locale].back}</Link></div>
  return <GamePlayer key={slug} slug={slug} />
}

function GamePlayer({ slug }: { slug: GameSlug }) {
  const { locale } = useLocale()
  const copy = copies[locale]
  const label = gameLabels[slug][locale]
  const [search, setSearch] = useSearchParams()
  const initialId = useRef(search.get('session'))
  const [catalog, setCatalog] = useState<SpeakingGame | null>(null)
  const [dashboard, setDashboard] = useState<GameDashboard | null>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [character, setCharacter] = useState<Companion>('penguin')
  const [level, setLevel] = useState('A1')
  const [rounds, setRounds] = useState(3)
  const [themeId, setThemeId] = useState('')
  const [transcript, setTranscript] = useState('')
  const [typed, setTyped] = useState('')
  const [textMode, setTextMode] = useState(false)
  const [speechStatus, setSpeechStatus] = useState<GameSpeechStatus>('idle')
  const [seconds, setSeconds] = useState(0)
  const [location, setLocation] = useState<string | null>(null)
  const [accusing, setAccusing] = useState(false)
  const [accusationRecording, setAccusationRecording] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(false)
  const [audioFailed, setAudioFailed] = useState(false)
  const [speech] = useState(() => new GameSpeech(setTranscript, setSpeechStatus))
  const busyRef = useRef(false)
  const alive = useRef(true)
  const current = useRef<GameSession | null>(null)
  const retryAction = useRef<(() => Promise<void>) | null>(null)
  const pendingAnswer = useRef<{ id: string; body: GameAnswer } | null>(null)
  const startRequest = useRef<StartGame | null>(null)
  const offset = useRef(0)
  const expiredVersion = useRef(-1)
  const audio = useRef<HTMLAudioElement | null>(null)
  const audioUrl = useRef<string | null>(null)
  const audioGeneration = useRef(0)

  function stopAudio() {
    audioGeneration.current++
    audio.current?.pause()
    audio.current = null
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audioUrl.current = null
    setPlayingAudio(false)
  }

  function adopt(value: GameSession) {
    if (!alive.current) return
    current.current = value
    offset.current = new Date(value.serverNowUtc).getTime() - Date.now()
    setSession(value)
    if (value.gameSlug === 'ice-mystery' && value.status === 'answering') setLocation(value.prompt.id)
    setSeconds(value.deadlineUtc ? Math.max(0, (new Date(value.deadlineUtc).getTime() - new Date(value.serverNowUtc).getTime()) / 1000) : value.durationSeconds)
    setSearch({ session: value.id }, { replace: true })
    if (value.pendingAnswer) pendingAnswer.current = { id: value.id, body: value.pendingAnswer }
    if (value.status === 'completed') void speakingGames.dashboard().then((stats) => { if (alive.current) setDashboard(stats) }).catch(() => {})
  }

  function failure(caught: unknown) {
    if (!alive.current) return
    if (caught instanceof RequestError && caught.code === 'game_disabled') setError(copy.disabled)
    else if (caught instanceof RequestError && /locked|access|lesson/.test(caught.code)) setError(`${copy.locked} ${copy.unlock}`)
    else if (caught instanceof RequestError && caught.status === 400) setError(caught.message)
    else setError(copy.error)
  }

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    retryAction.current = action
    try { await action(); retryAction.current = null } catch (caught) {
      if (caught instanceof RequestError && caught.status === 409 && current.current) {
        speech.abort()
        try {
          const updated = await speakingGames.session(slug, current.current.id)
          pendingAnswer.current = null
          retryAction.current = null
          adopt(updated)
          return
        } catch { failure(caught) }
      } else {
        if (caught instanceof RequestError && caught.status === 400) {
          pendingAnswer.current = null
          retryAction.current = null
          setAccusationRecording(false)
        }
        failure(caught)
      }
    } finally {
      busyRef.current = false
      if (alive.current) setBusy(false)
    }
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      speech.abort()
      audioGeneration.current = -1
      audio.current?.pause()
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    }
  }, [speech])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void Promise.all([speakingGames.catalog(), speakingGames.dashboard(), initialId.current ? speakingGames.session(slug, initialId.current) : Promise.resolve(null)])
      .then(([games, stats, saved]) => {
        if (!active) return
        const game = games.find((entry) => entry.slug === slug) ?? null
        setCatalog(game)
        setDashboard(stats)
        setThemeId(game?.themes[0]?.id ?? '')
        if (saved && saved.gameSlug === slug) {
          current.current = saved
          offset.current = new Date(saved.serverNowUtc).getTime() - Date.now()
          setSession(saved)
          if (saved.gameSlug === 'ice-mystery' && saved.status === 'answering') setLocation(saved.prompt.id)
          if (saved.pendingAnswer) pendingAnswer.current = { id: saved.id, body: saved.pendingAnswer }
        }
      }).catch(() => { if (active) setError(copies[locale].error) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug, reload, locale])

  async function playAudio(value: GameSession, target: 'prompt' | 'feedback') {
    stopAudio()
    if (readAudioPreferences().muted) return
    const generation = audioGeneration.current
    setPlayingAudio(true)
    setAudioFailed(false)
    try {
      const blob = await speakingGames.audio(slug, value.id, target)
      if (!alive.current || generation !== audioGeneration.current) return
      const url = URL.createObjectURL(blob)
      audioUrl.current = url
      const element = new Audio(url)
      audio.current = element
      element.playbackRate = readAudioPreferences().speed
      element.onended = () => { if (generation === audioGeneration.current) stopAudio() }
      element.onerror = () => { if (generation === audioGeneration.current) { stopAudio(); setAudioFailed(true) } }
      await element.play()
    } catch {
      if (alive.current && generation === audioGeneration.current) { stopAudio(); setAudioFailed(true) }
    }
  }

  async function start() {
    if (!catalog?.isAccessible) return
    startRequest.current ??= { requestId: crypto.randomUUID(), character, level, rounds, themeId: slug === 'tez-gapir' ? themeId : undefined }
    const request = startRequest.current
    await run(async () => {
      adopt(await speakingGames.start(slug, request))
      startRequest.current = null
      setLocation(null)
      setAccusing(false)
    })
  }

  async function command(action: string, locationId?: string) {
    const value = current.current
    if (!value) return
    const body = { requestId: crypto.randomUUID(), expectedVersion: value.version, locationId }
    await run(async () => {
      speech.abort()
      stopAudio()
      const next = await speakingGames.command(slug, value.id, action, body)
      adopt(next)
      setTranscript('')
      setTyped('')
      pendingAnswer.current = null
      if (slug === 'ice-mystery' && (action === 'visit' || action === 'next')) { setLocation(next.prompt.id); setAccusing(false); setAccusationRecording(false) }
    })
  }

  async function begin() {
    const value = current.current
    if (!value || busyRef.current) return
    stopAudio()
    const continuing = value.status === 'answering'
    if (!continuing) { setTranscript(''); setTyped('') }
    setError('')
    if (!textMode) {
      busyRef.current = true
      setBusy(true)
      try { await speech.start(continuing) } catch { busyRef.current = false; setBusy(false); return }
      busyRef.current = false
      setBusy(false)
    }
    if (!alive.current) { speech.abort(); return }
    if (accusing) { setAccusationRecording(true); return }
    if (value.status === 'answering') return
    const body = { requestId: crypto.randomUUID(), expectedVersion: value.version, locationId: location ?? undefined }
    await run(async () => {
      try { adopt(await speakingGames.command(slug, value.id, 'begin', body)) } catch (caught) { speech.abort(); throw caught }
    })
  }

  async function submit() {
    const value = current.current
    if (!value || busyRef.current) return
    stopAudio()
    if (!pendingAnswer.current) {
      busyRef.current = true
      setBusy(true)
      const answer = textMode ? typed.trim() : await speech.finish()
      if (!alive.current) return
      pendingAnswer.current = {
        id: value.id,
        body: { requestId: crypto.randomUUID(), expectedVersion: value.version, text: answer, action: slug === 'ice-mystery' ? accusing ? 'accuse' : 'question' : 'answer', locationId: location ?? undefined },
      }
      setTranscript(answer)
      busyRef.current = false
      setBusy(false)
    }
    const request = pendingAnswer.current
    await run(async () => {
      const result = await speakingGames.answer(slug, request.id, request.body)
      adopt(result)
      setAccusationRecording(false)
      pendingAnswer.current = null
      if (result.feedback?.characterPhrase) void playAudio(result, 'feedback')
    })
  }

  const submitRef = useRef(submit)
  submitRef.current = submit
  useEffect(() => {
    if (session?.status !== 'answering' || !session.deadlineUtc) return
    const deadline = new Date(session.deadlineUtc).getTime()
    const tick = () => {
      const remaining = Math.max(0, (deadline - Date.now() - offset.current) / 1000)
      setSeconds(remaining)
      if (remaining === 0 && expiredVersion.current !== session.version && !busyRef.current) {
        expiredVersion.current = session.version
        void submitRef.current()
      }
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [session?.status, session?.version, session?.deadlineUtc])

  async function resume(id: string) {
    await run(async () => { setLocation(null); setAccusing(false); adopt(await speakingGames.session(slug, id)) })
  }

  async function enterAccusation() {
    if (session?.status === 'feedback') await command('next')
    if (current.current?.status === 'ready' || current.current?.availableActions.includes('accuse')) {
      stopAudio()
      setAccusing(true)
      setLocation(null)
      setTranscript('')
      setTyped('')
    }
  }

  function again() {
    speech.abort()
    stopAudio()
    current.current = null
    initialId.current = null
    setSession(null)
    setSearch({}, { replace: true })
    setError('')
    setTranscript('')
    setTyped('')
    setLocation(null)
    setAccusing(false)
    setAccusationRecording(false)
    pendingAnswer.current = null
  }

  const active = dashboard?.activeSessions.find((entry) => entry.gameSlug === slug)
  const answering = session?.status === 'answering' || accusationRecording
  const isMystery = slug === 'ice-mystery'
  const feedback = session?.status === 'feedback' && !accusing ? session.feedback : null
  const showMap = isMystery && session && !location && !accusing && session.status !== 'completed'
  const modeEditable = !busy && !answering && !feedback
  const pending = Boolean(pendingAnswer.current || session?.pendingAnswer)

  return <main className="sg" data-game={slug}>
    <nav className="sg-nav"><Link to="/games" onClick={() => { speech.abort(); stopAudio() }}><span aria-hidden="true">←</span>{copy.games}</Link><strong>{label.title}</strong></nav>
    <div className="sg-content">
      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        {error && <div className="sg-error" role="alert">{error}<button onClick={() => { if (retryAction.current) void run(retryAction.current); else if (pending) void submit(); else setReload((n) => n + 1) }} disabled={busy}>{copy.retry}</button></div>}
        {!session && catalog && <>
          <div className="sg-intro"><section><GameMark game={slug} className="sg-mark" /><h1>{label.title}</h1><p>{label.description}</p><div className="sg-rules"><h2>{copy.rules}</h2><p>{label.rules}</p></div></section>
            <div className="sg-setup"><CompanionPicker value={character} onChange={(value) => { setCharacter(value); startRequest.current = null }} copy={copy} disabled={busy} />
              {!isMystery && <label className="sg-field">{copy.level}<select value={level} disabled={busy} onChange={(event) => { setLevel(event.target.value); startRequest.current = null; setThemeId(catalog.themes.find((item) => item.level === event.target.value)?.id ?? '') }}>{catalog.levels.map((value) => <option key={value}>{value}</option>)}</select></label>}
              {slug === 'tez-gapir' && <><label className="sg-field">{copy.theme}<select value={themeId} disabled={busy} onChange={(event) => { setThemeId(event.target.value); startRequest.current = null }}>{catalog.themes.filter((theme) => theme.level === level).map((theme) => <option key={theme.id} value={theme.id}>{locale === 'uz' ? theme.titleUz : theme.titleRu}</option>)}</select></label><label className="sg-field">{copy.rounds}<select value={rounds} disabled={busy} onChange={(event) => { setRounds(Number(event.target.value)); startRequest.current = null }}>{[3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label></>}
              {!catalog.isEnabled ? <p role="status" className="sg-muted">{copy.disabled}</p> : !catalog.isAccessible ? <p role="status" className="sg-muted">{copy.locked} {copy.unlock}</p> : active ? <><p className="sg-muted">{copy.savedGame}</p><Button disabled={busy} onClick={() => void resume(active.id)}>{copy.resume}</Button></> : <Button size="lg" disabled={busy} onClick={() => void start()}>{busy ? copy.loading : copy.start}</Button>}
              <p className="sg-muted">{copy.timeNote}</p>
            </div></div>
          <Statistics slug={slug} copy={copy} dashboard={dashboard} />
        </>}
        {!session && !catalog && !error && <p className="sg-muted">{copy.disabled}</p>}
        {session?.status === 'completed' && <><Results session={session} copy={copy} onAgain={again} /><Statistics slug={slug} copy={copy} dashboard={dashboard} /></>}
        {session && session.status !== 'completed' && <>
          <div className="sg-hud"><span>{isMystery ? copy.questions : copy.rounds} {Math.min(session.roundIndex + 1, session.totalRounds)} / {session.totalRounds}</span><span>{copy.score} <strong>{session.score}</strong></span></div>
          {!isMystery && <div className="sg-progress"><span style={{ width: `${session.history.length / session.totalRounds * 100}%` }} /></div>}
          {showMap ? <MysteryMap session={session} copy={copy} busy={busy} visit={(id) => void command(session.status === 'feedback' ? 'next' : 'visit', id)} accuse={() => void enterAccusation()} /> : <>
            <div className="sg-board">
              {isMystery && <button disabled={busy || answering} onClick={() => { speech.abort(); stopAudio(); setLocation(null); setAccusing(false) }} className="mb-5 text-sm font-bold text-signal-ink">← {copy.leave}</button>}
              {slug === 'first-reaction' && session.prompt.kind !== 'ready' && <ReactionScene text={session.prompt.textRu} />}
              {!isMystery && <Timer seconds={answering ? seconds : session.durationSeconds} duration={session.durationSeconds} label={copy.seconds} />}
              <h1 className="sg-prompt" lang={accusing || session.prompt.kind === 'ready' ? undefined : 'ru'}>{accusing ? copy.accusation : session.prompt.kind === 'ready' ? copy.ready : session.prompt.textRu}</h1>
              {locale === 'uz' && session.prompt.titleUz && <p className="sg-muted mb-4">{session.prompt.titleUz}</p>}
              {!answering && !busy && !feedback && !accusing && session.prompt.kind !== 'ready' && <Button variant="ghost" disabled={playingAudio} onClick={() => void playAudio(session, 'prompt')}>{playingAudio ? copy.loading : copy.listen}</Button>}
              {!feedback && <>
                {!speech.supported && <p className="sg-muted my-5">{copy.unsupported}</p>}
                {(speechStatus === 'denied' || speechStatus === 'failed') && <div className="sg-error" role="alert"><strong>{speechStatus === 'denied' ? copy.micDenied : copy.micFailed}</strong>{speechStatus === 'denied' && <p>{copy.micHelp}</p>}</div>}
                {modeEditable && <div className="sg-actions"><Button variant="ghost" onClick={() => { speech.abort(); setTextMode(!textMode) }}>{textMode ? copy.voice : copy.type}</Button></div>}
                {textMode && <p className="sg-muted mt-4">{copy.textMode}</p>}
                {(answering || transcript || pending) && <div className="sg-transcript"><small>{copy.answer}</small>{textMode && answering ? <textarea aria-label={copy.answer} lang="ru" maxLength={4000} value={typed} onChange={(event) => setTyped(event.target.value)} disabled={busy} className="sg-textarea" autoFocus /> : <div lang="ru">{transcript || session.pendingAnswer?.text || '...'}</div>}</div>}
                <div className="sg-actions">
                  {answering || pending ? <>
                    {!textMode && speechStatus !== 'listening' && !busy && !pending && <button className="sg-mic" aria-label={copy.speak} onClick={() => void begin()}><MicMark /></button>}
                    <Button size="lg" disabled={busy} onClick={() => void submit()}>{busy ? copy.saving : pending ? copy.retry : slug === 'tez-gapir' ? copy.stop : copy.submit}</Button>
                  </> : <Button size="lg" disabled={busy || (!textMode && !speech.supported)} onClick={() => void begin()}><MicMark />{busy ? copy.preparing : copy.speak}</Button>}
                </div>
                {answering && speechStatus === 'listening' && <p className="sg-status" role="status">{copy.listening}</p>}
                {slug === 'tez-gapir' && answering && !transcript && seconds < session.durationSeconds - 3 && <p className="sg-muted">{copy.silence}</p>}
              </>}
              {feedback && <><CharacterNote companion={isMystery ? session.locations.find((item) => item.id === location)?.character ?? session.character : session.character}>{isMystery ? feedback.explanation : feedback.characterPhrase}</CharacterNote><Feedback feedback={feedback} copy={copy} hideExplanation={isMystery} /><div className="sg-actions"><Button variant="secondary" disabled={busy || playingAudio} onClick={() => void playAudio(session, 'feedback')}>{copy.listen}</Button><Button size="lg" disabled={busy} onClick={() => void command('next', location ?? undefined)}>{copy.next}</Button></div></>}
              {audioFailed && <p className="sg-muted mt-4" role="status">{copy.audioFailed}</p>}
              {isMystery && session.history.length > 0 && <div className="sg-dialogue" aria-label={copy.history}>{session.history.filter((turn) => turn.locationId === location).map((turn, index) => <div key={index}><blockquote data-speaker="player"><small>{copy.answer}</small><span lang="ru">{turn.feedback.answer}</span></blockquote><blockquote className="mt-2" lang="ru">{turn.feedback.explanation}</blockquote></div>)}</div>}
            </div>
            {isMystery && <div className="mt-8"><Evidence session={session} copy={copy} /></div>}
          </>}
          {(!answering || pending) && <div className="mt-10 text-center"><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm(copy.endConfirm)) void command('end') }}>{copy.finish}</Button></div>}
        </>}
      </>}
    </div>
  </main>
}
