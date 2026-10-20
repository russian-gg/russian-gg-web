import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Gem, LockKeyhole, Mic, Share2, Square, Volume2 } from 'lucide-react'
import { useLocale } from '../../../lib/i18n'
import { RequestError } from '../../../lib/api'
import { VoiceError } from '../../../lib/liveVoice'
import { lifeApi, type LifeCharacter, type LifeTopic } from './api'
import { lifeCopies } from './copy'
import { LifeScene } from './LifeScene'
import { useLifeGame } from './useLifeGame'
import './life.css'

const characters: LifeCharacter[] = ['penguin', 'panda', 'pero']

export function FightForLife() {
  const { locale } = useLocale()
  const copy = lifeCopies[locale]
  const game = useLifeGame()
  const [catalog, setCatalog] = useState<{ isEnabled: boolean; topics: LifeTopic[] } | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [reload, setReload] = useState(0)
  const [character, setCharacter] = useState<LifeCharacter>('penguin')
  const [level, setLevel] = useState('A1')
  const [mode, setMode] = useState('debate')
  const [topicId, setTopicId] = useState('01')
  const [shared, setShared] = useState(false)
  useEffect(() => {
    let active = true
    setCatalogError(false)
    void lifeApi.catalog().then(result => { if (active) setCatalog(result) }).catch(() => { if (active) setCatalogError(true) })
    return () => { active = false }
  }, [reload])
  const topics = catalog?.topics.filter(topic => topic.mode === mode && topic.level === (level === 'B1' ? 'B1' : 'A1-A2')) ?? []
  const selected = topics.find(topic => topic.id === topicId) ?? topics[0]
  const playing = game.phase === 'playing' || game.phase === 'saving'
  const shownCharacter = game.view?.character ?? character
  const code = game.error instanceof RequestError || game.error instanceof VoiceError ? game.error.code : String(game.error)
  const errorText = code.startsWith('mic_') ? copy.mic : code === 'voice_daily_limit' ? copy.limit : code.startsWith('provider_') ? copy.unavailable : code === 'game_disabled' ? copy.disabled : copy.error
  const emotion = game.visual.emotion
  const name = shownCharacter === 'penguin' ? 'Penguin' : shownCharacter === 'panda' ? 'Panda' : 'Pero'
  const phrase = copy[`${emotion === 'speaking' ? 'speaking' : emotion === 'cold' || emotion === 'frozen' ? 'cold' : 'waiting'}${name}`]
  async function share() {
    const text = `Борьба за жизнь · ${game.view?.score ?? 0} ${copy.crystals}`
    try {
      if (navigator.share) await navigator.share({ title: 'Борьба за жизнь', text })
      else { await navigator.clipboard.writeText(text); setShared(true) }
    } catch { setShared(false) }
  }
  return <main className="life-game" data-character={shownCharacter} data-phase={game.phase}>
    <div className="life-bokeh" aria-hidden="true"><i /><i /><i /></div>
    <div className="life-wrap">
      <header className="life-header">
        <Link to="/games"><ArrowLeft size={17} />{copy.back}</Link>
        <span lang="ru">БОРЬБА ЗА ЖИЗНЬ</span>
      </header>
      {catalogError ? <div className="life-notice" role="alert"><p>{copy.error}</p><button onClick={() => setReload(n => n + 1)}>{copy.retry}</button></div>
        : !catalog ? <p className="life-notice" role="status">{copy.loading}</p>
          : !catalog.isEnabled ? <div className="life-notice"><LockKeyhole size={34} /><p>{copy.disabled}</p></div>
            : game.phase === 'setup' ? <>
              <section className="life-intro"><span className="life-eyebrow"><span />{copy.tag}</span><h1>{copy.intro}</h1><p>{copy.rules}</p></section>
              <section className="life-setup">
                <h2>{copy.character}</h2>
                <div className="life-choices">{characters.map(id => <button key={id} className="life-character-choice" data-character={id} aria-pressed={character === id} onClick={() => setCharacter(id)}>
                  <LifeScene character={id} compact />
                  <span className="life-character-name">{copy[id]}{character === id && <Check size={16} />}</span>
                  <small>{copy[`${id}Role`]}</small>
                </button>)}</div>
                <div className="life-options">
                  <fieldset><legend>{copy.level}</legend><div className="life-segment">{['A1', 'A2', 'B1'].map(item => <button key={item} aria-pressed={level === item} onClick={() => setLevel(item)}>{item}</button>)}</div></fieldset>
                  <fieldset><legend>{copy.mode}</legend><div className="life-segment">{(['debate', 'monologue'] as const).map(item => <button key={item} aria-pressed={mode === item} onClick={() => setMode(item)}>{copy[item]}</button>)}</div></fieldset>
                </div>
                <label className="life-topic-label" htmlFor="life-topic">{copy.topic}</label>
                <select id="life-topic" value={selected?.id ?? ''} onChange={event => setTopicId(event.target.value)} lang="ru">{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
                <button className="life-start" disabled={!selected} onClick={() => selected && void game.start(character, level, selected.id)}><Mic size={22} />{copy.start}<ArrowRight size={20} /></button>
              </section>
            </> : game.phase === 'connecting' ? <section className="life-connecting" role="status"><LifeScene character={shownCharacter} /><span className="life-eyebrow">{copy.connecting}</span></section>
              : game.phase === 'error' ? <section className="life-notice" role="alert"><p>{errorText}</p><button onClick={() => void game.recover()}>{copy.retry}</button><button onClick={game.reset}>{copy.again}</button></section>
                : playing ? <section className="life-play">
                  <div className="life-hud"><span data-speaking={game.visual.speaking}>{game.visual.tutor ? <Volume2 size={20} /> : <Mic size={20} />}<span>{game.visual.tutor ? copy.tutor : game.visual.speaking ? copy.listening : emotion === 'cold' ? copy.critical : copy.keepGoing}</span></span><div aria-label={copy.score}><Gem size={21} /><strong key={game.visual.score}>{game.visual.score}</strong></div></div>
                  <div className="life-topic"><span>{copy[game.view?.topic.mode ?? 'debate']} · {game.view?.level}</span><h1 lang="ru">{game.view?.topic.title}</h1></div>
                  <LifeScene character={shownCharacter} emotion={emotion} energy={game.visual.energy} volume={game.visual.volume} />
                  <div className="life-reaction" lang={game.visual.tutor ? 'ru' : undefined}>{game.visual.tutor ? game.tutorLine : phrase}</div>
                  <button className="life-mic" data-speaking={game.visual.speaking} aria-label={copy.stop} disabled={game.phase === 'saving'} onClick={() => void game.stop()}>
                    {game.visual.speaking ? <span className="life-mic-bars">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ height: `${12 + game.visual.volume * (i % 2 ? 30 : 18)}px` }} />)}</span> : <Square size={23} fill="currentColor" />}<span>{game.phase === 'saving' ? copy.loading : copy.stop}</span>
                  </button>
                </section> : game.view && <section className="life-results">
                  <span className="life-eyebrow">{copy.crystals}</span>
                  <h1>{game.view.outcome === 'won' ? copy.won : game.view.outcome === 'silence' ? copy.lost : copy.stopped}</h1>
                  <LifeScene character={shownCharacter} emotion={game.view.outcome === 'won' ? 'won' : game.view.outcome === 'silence' ? 'frozen' : 'idle'} energy={game.view.outcome === 'won' ? 1 : .25} />
                  <div className="life-result-score"><Gem /><strong>{game.view.score}</strong><span>{copy.score}</span></div>
                  <p className="life-result-note">{game.view.outcome === 'won' ? copy.wonNote : copy.lostNote}</p>
                  <div className="life-result-details"><span><strong>{Math.floor(game.view.speechMilliseconds / 1000)}</strong>{copy.seconds}</span><span><strong>{game.view.transcript.match(/[\p{L}]+/gu)?.length ?? 0}</strong>{copy.words}</span></div>
                  <p className="life-small">{copy.pointsNote}</p>
                  <div className="life-result-actions"><button className="life-start" onClick={() => { setShared(false); game.reset() }}>{copy.again}<ArrowRight size={19} /></button><button className="life-share" onClick={() => void share()}><Share2 size={19} />{shared ? copy.copied : copy.share}</button></div>
                  {game.view.transcript && <details className="life-transcript"><summary>{copy.transcript}</summary><p lang="ru">{game.view.transcript}</p></details>}
                </section>}
    </div>
  </main>
}
