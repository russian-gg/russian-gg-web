import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { Check, Gamepad2, MessagesSquare, Pause, Play, Route } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { fill, useT } from '../../../lib/i18n'
import { BrowserFrame } from '../devices'
import { DemoStage } from './DemoStage'
import { COMPACT_BELOW } from './engine'
import { GamesMock } from './GamesMock'
import { LessonsMock } from './LessonsMock'
import { MissionsMock } from './MissionsMock'
import { gamesScene, lessonsScene, missionsScene } from './scenes'
import '../alive.css'
import './tour.css'

/**
 * The product tour: three tabs, each a scripted, looping demo of the real screens — the 90-day
 * path, an AI voice mission, a voice game — played by a fake cursor in a browser window.
 *
 * Each scene plays once and hands over to the next tab, so the tour as a whole loops. It stops
 * while it is off screen, while the browser tab is hidden and when the visitor presses pause;
 * under reduced motion there is no cursor and no autoplay, only each scene's most telling frame.
 *
 * The demo itself is decoration (`aria-hidden`); each scene has a written description for
 * screen readers, and the step captions beside it are real text.
 */

const SCENES = ['lessons', 'missions', 'games'] as const
const ICONS = [Route, MessagesSquare, Gamepad2]

export function ProductTour() {
  const t = useT().landing.tour
  const reduced = useReducedMotion() ?? false
  const id = useId()

  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLSpanElement>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])

  const inView = useInView(root, { amount: 0.3 })
  const pageVisible = usePageVisible()
  const compact = useCompact(panel)

  const [tab, setTab] = useState(0)
  const [run, setRun] = useState(0)
  const [paused, setPaused] = useState(false)
  const [caption, setCaption] = useState(0)

  const playing = !paused && inView && pageVisible

  const select = (index: number) => {
    setTab(index)
    setRun((value) => value + 1)
  }

  const onEnd = useCallback(() => {
    setTab((value) => (value + 1) % SCENES.length)
    setRun((value) => value + 1)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = SCENES.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (tab === last ? 0 : tab + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (tab === 0 ? last : tab - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    select(next)
    tabs.current[next]?.focus()
  }

  const copy = t[SCENES[tab]]
  const steps = [copy.step1, copy.step2, copy.step3, copy.step4]
  const stage = { compact, animate: !reduced, playing, progress, onEnd, onCaption: setCaption }
  const key = `${tab}-${run}-${compact ? 'c' : 'w'}`

  return (
    <div ref={root} className="tour mx-auto w-full">
      <div className="tour-shell">
        <div role="tablist" aria-label={t.label} onKeyDown={onKeyDown} className="tour-tabs">
          {SCENES.map((scene, index) => {
            const Icon = ICONS[index]
            const selected = index === tab
            return (
              <button
                key={scene}
                ref={(el) => {
                  tabs.current[index] = el
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${index}`}
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                data-selected={selected ? '' : undefined}
                className="tour-tab relative flex min-h-11 min-w-0 items-center overflow-hidden text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                <span aria-hidden="true" className="tour-tab-icon grid shrink-0 place-items-center">
                  <Icon className="size-[18px]" strokeWidth={2.4} />
                </span>
                <span className="tour-tab-text min-w-0">
                  <span className="block truncate text-[15px] leading-tight font-black">{t[scene].tab}</span>
                  <span className="tour-tab-sub mt-0.5 block truncate text-[13px] leading-tight font-semibold">{t[scene].title}</span>
                </span>
                {selected && !reduced && (
                  <span aria-hidden="true" className="tour-tab-track absolute overflow-hidden rounded-full">
                    <span ref={progress} className="tour-tab-progress block h-full rounded-full" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <p className="tour-intro mx-auto max-w-2xl text-center text-[15px] leading-relaxed text-ink-muted">{copy.blurb}</p>

        <div
          ref={panel}
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${tab}`}
          tabIndex={0}
          className="tour-panel relative min-w-0 rounded-[1.2rem] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal"
        >
          <p className="sr-only">{copy.description}</p>
          {/* The light running round the window sits on a wrapper: the frame clips its own edge. */}
          <div className="alive-beam rounded-[1.1rem]">
            <BrowserFrame url={copy.url} className="tour-frame">
              {tab === 0 && <DemoStage key={key} scene={lessonsScene} Mock={LessonsMock} {...stage} />}
              {tab === 1 && <DemoStage key={key} scene={missionsScene} Mock={MissionsMock} {...stage} />}
              {tab === 2 && <DemoStage key={key} scene={gamesScene} Mock={GamesMock} {...stage} />}
            </BrowserFrame>
          </div>
        </div>

        {/* The player bar under the window: pause, and the four chapters of the scene. */}
        <div className="tour-player">
          {!reduced && (
            <button
              type="button"
              aria-label={t.pause}
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
              className="tour-pause grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              {paused ? (
                <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
              ) : (
                <Pause aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
              )}
            </button>
          )}
          <ol className="tour-steps min-w-0 flex-1">
            {steps.map((step, index) => {
              const active = index === caption
              const passed = index < caption
              return (
                <li
                  key={index}
                  data-active={active ? '' : undefined}
                  data-passed={passed ? '' : undefined}
                  className="tour-step"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cx(
                        'grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-black transition-[background-color,color] duration-300',
                        active
                          ? 'bg-signal text-on-signal'
                          : passed
                            ? 'bg-signal-soft text-signal-ink'
                            : 'bg-ground-sunken text-ink-faint',
                      )}
                    >
                      {passed ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span
                      className={cx(
                        'line-clamp-2 text-[14px] leading-snug transition-colors duration-300',
                        active ? 'font-extrabold text-ink' : 'font-semibold text-ink-muted',
                      )}
                    >
                      <span className="sr-only">{fill(t.stepOf, { step: index + 1, total: steps.length })}: </span>
                      {step}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

/** False while the browser tab is in the background. */
function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

/** Whether the panel is narrow enough for the compact mock. Same threshold as tour.css. */
function useCompact(panel: RefObject<HTMLDivElement | null>) {
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const measure = () => setCompact(el.clientWidth < COMPACT_BELOW)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [panel])
  return compact
}
