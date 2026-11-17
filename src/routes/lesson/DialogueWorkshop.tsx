import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Headphones, Mic, Play, RotateCcw, Square } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { RussianText } from '../../components/RussianText'
import { readAudioPreferences } from '../../lib/audio-preferences'
import { cx } from '../../lib/cx'
import {
  buildWorkshop,
  emptyWorkshopProgress,
  isWorkshopDone,
  WORKSHOP_STAGES,
  type ChoiceItem,
  type Workshop,
  type WorkshopLine,
  type WorkshopProgress,
} from '../../lib/dialogue-workshop'
import type { LessonData } from '../../lib/foundation-lessons'
import { fill, useT } from '../../lib/i18n'
import { playPromptAudio, prefetchPromptAudio, stopPromptAudio } from '../../lib/liveVoice'
import { mascotImage } from '../../lib/mascot-images'
import { playUiSound } from '../../lib/ui-sounds'
import type { TeacherMark } from '../../lib/types'

/*
  The lesson's sixth step for a learner on the plan without AI. Where the other plan records
  the learner and sends the recording to a model, this one works the same dialogue six ways and
  checks every answer against the dialogue itself — see lib/dialogue-workshop.

  Sound here is stored lesson audio and nothing else. A line whose clip is missing says so and
  stays readable; it is never read by the browser's own voice, which is not the voice the
  lesson was written for.
*/

type Update = (change: (current: WorkshopProgress) => WorkshopProgress) => void

export function DialogueWorkshop({ lesson, progress: saved, onProgress, onRecorded, teacherMarks }: {
  lesson: LessonData
  progress: WorkshopProgress | undefined
  onProgress: Update
  /** A line the learner recorded, for a center that has its teacher review recordings. */
  onRecorded?: (line: WorkshopLine, audio: Blob) => void
  /** What the teacher said about those recordings; undefined when the center has no review. */
  teacherMarks?: TeacherMark[]
}) {
  const t = useT().lesson.workshop
  const workshop = useMemo(() => buildWorkshop(lesson), [lesson])
  const progress = saved ?? emptyWorkshopProgress
  const stage = WORKSHOP_STAGES[progress.stage]

  // Leaving the step, or moving to the next stage, stops whatever was playing.
  useEffect(() => stopPromptAudio, [progress.stage])

  function nextStage() {
    playUiSound('correct')
    onProgress((current) => ({ ...current, stage: current.stage + 1, item: 0 }))
  }

  /** One answer in stages 2–5: counted once, right on the first try or not. */
  function answered(firstTry: boolean) {
    onProgress((current) => ({
      ...current,
      asked: current.asked + 1,
      firstTry: current.firstTry + (firstTry ? 1 : 0),
    }))
  }

  if (isWorkshopDone(progress)) {
    return (
      <Card className="p-5 text-center sm:p-6">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-milestone-soft text-milestone">
          <Check aria-hidden="true" strokeWidth={3} className="size-7" />
        </span>
        <p role="status" className="mt-3 text-lg font-black text-ink">{t.done}</p>
        {progress.asked > 0 && (
          <p className="mt-1 text-sm font-bold text-ink-muted">
            {fill(t.doneScore, { right: progress.firstTry, total: progress.asked })}
          </p>
        )}
        <p className="mt-1 text-sm text-ink-muted">{t.doneNext}</p>
        {teacherMarks && <TeacherMarks marks={teacherMarks} />}
        <Button variant="ghost" className="mt-3" onClick={() => onProgress(() => ({ ...emptyWorkshopProgress }))}>
          <RotateCcw aria-hidden="true" className="size-4" /> {t.restart}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-5">
      <StageRail current={progress.stage} />

      {stage === 'listen' && <ListenStage workshop={workshop} onDone={nextStage} />}

      {stage === 'order' && (
        <OrderStage
          workshop={workshop}
          placed={progress.ordered}
          onPlaced={(firstTry) => {
            answered(firstTry)
            onProgress((current) => ({ ...current, ordered: current.ordered + 1 }))
          }}
          onDone={nextStage}
        />
      )}

      {stage === 'reply' && (
        <ChoiceStage
          key="reply"
          items={workshop.replies}
          index={progress.item}
          body={t.replyBody}
          wrongNote={t.replyWrong}
          onAnswered={answered}
          onNext={() => onProgress((current) => ({ ...current, item: current.item + 1 }))}
          onDone={nextStage}
          prompt={(item) => <Bubble line={item.prompt} playable />}
        />
      )}

      {stage === 'gap' && (
        <ChoiceStage
          key="gap"
          items={workshop.gaps}
          index={progress.item}
          body={t.gapBody}
          wrongNote={t.gapWrong}
          wordOptions
          onAnswered={answered}
          onNext={() => onProgress((current) => ({ ...current, item: current.item + 1 }))}
          onDone={nextStage}
          prompt={(item, solved) => (
            <Bubble
              line={item.line}
              text={`${item.before}${solved ? item.answer : '_____'}${item.after}`}
              playable={solved}
            />
          )}
        />
      )}

      {stage === 'questions' && (
        <ChoiceStage
          key="questions"
          items={workshop.questions}
          index={progress.item}
          body={t.questionsBody}
          wrongNote={t.questionWrong}
          onAnswered={answered}
          onNext={() => onProgress((current) => ({ ...current, item: current.item + 1 }))}
          onDone={nextStage}
          prompt={(item) => (
            <p className="rounded-2xl bg-signal-soft p-4 text-center text-lg font-black text-ink">
              <RussianText text={item.question} />
            </p>
          )}
        />
      )}

      {stage === 'read' && (
        <ReadStage
          workshop={workshop}
          read={progress.read}
          micSkipped={progress.micSkipped}
          onRead={(index) => onProgress((current) => ({
            ...current,
            read: current.read.includes(index) ? current.read : [...current.read, index],
          }))}
          onSkipMic={() => onProgress((current) => ({ ...current, micSkipped: true }))}
          onRecorded={onRecorded}
          reviewed={teacherMarks !== undefined}
          onDone={nextStage}
        />
      )}
    </Card>
  )
}

/** The teacher's marks on the lines read aloud, once there are any; a waiting note until then. */
function TeacherMarks({ marks }: { marks: TeacherMark[] }) {
  const t = useT().lesson.workshop
  const marked = marks.filter((mark) => mark.mark != null)
  if (marks.length === 0) return null
  return (
    <div className="mt-4 rounded-2xl bg-ground-sunken p-4 text-left">
      <p className="text-[10px] font-black tracking-[.12em] text-ink-faint uppercase">{t.teacherTitle}</p>
      {marked.length === 0
        ? <p className="mt-1 text-sm text-ink-muted">{t.teacherWaiting}</p>
        : (
          <ul className="mt-2 grid gap-2">
            {marked.map((mark, index) => (
              <li key={`${mark.lineText}-${index}`} className="text-sm">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-ink"><RussianText text={mark.lineText} /></span>
                  <span className="shrink-0 font-black tabular-nums text-milestone">{fill(t.teacherMark, { mark: mark.mark ?? 0 })}</span>
                </p>
                {mark.comment && <p className="mt-0.5 text-ink-muted">{mark.comment}</p>}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

/** The six stages as a row of marks: done, current, ahead. */
function StageRail({ current }: { current: number }) {
  const t = useT().lesson.workshop
  return (
    <ol className="mb-4 grid grid-cols-6 gap-1.5">
      {WORKSHOP_STAGES.map((stage, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={stage} aria-current={active ? 'step' : undefined} className="min-w-0 text-center">
            <span
              className={cx(
                'mx-auto flex size-8 items-center justify-center rounded-full text-xs font-black tabular-nums',
                active ? 'bg-signal text-on-signal ring-3 ring-signal-soft' : done ? 'bg-milestone-soft text-milestone' : 'bg-ground-sunken text-ink-muted',
              )}
            >
              {done ? <Check aria-hidden="true" strokeWidth={3} className="size-3.5" /> : index + 1}
            </span>
            <span className={cx('mt-1 block truncate text-[10px] font-black sm:text-xs', active ? 'text-signal-ink' : 'text-ink-faint')}>
              {t.stages[stage]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Plays one stored line and resolves when it has finished; rejects when there is no clip. */
function playLine(line: WorkshopLine) {
  return new Promise<void>((resolve, reject) => {
    if (readAudioPreferences().muted) {
      resolve()
      return
    }
    let started = false
    window.dispatchEvent(new CustomEvent('rgg-speech-start', { detail: { id: null } }))
    void playPromptAudio(line.speech, {
      character: line.speaker,
      onStateChange: (state) => {
        if (state === 'playing') started = true
        if (state === 'idle' && started) resolve()
      },
    }).catch(reject)
  })
}

/** One dialogue line as a chat bubble beside the character who says it. */
function Bubble({ line, text, playable = false, lit = false }: {
  line: WorkshopLine
  /** Shown in place of the line's own text — a line with a word taken out. */
  text?: string
  playable?: boolean
  lit?: boolean
}) {
  const t = useT().lesson.workshop
  const names = useT().lesson.game.speakers
  const [missing, setMissing] = useState(false)
  const right = line.speaker ? line.speaker === 'panda' : line.index % 2 === 1
  return (
    <div className={cx('flex items-end gap-2', right && 'flex-row-reverse')}>
      {line.speaker
        ? <img src={mascotImage(line.speaker)} alt={names[line.speaker]} className="size-11 shrink-0 object-contain sm:size-14" />
        : <span aria-hidden="true" className="size-11 shrink-0 sm:size-14" />}
      <div
        className={cx(
          'min-w-0 max-w-[80%] rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed sm:text-base',
          right ? 'rounded-br-md bg-signal-soft' : 'rounded-bl-md bg-ground-sunken',
          lit && 'ring-2 ring-signal',
        )}
      >
        <p className="text-ink"><RussianText text={text ?? line.text} /></p>
        {missing && <p className="mt-1 text-xs text-ink-faint">{t.audioMissing}</p>}
      </div>
      {playable && (
        <button
          type="button"
          aria-label={t.listenModel}
          onClick={() => void playLine(line).then(() => setMissing(false), () => setMissing(true))}
          className="raised raised-sm flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted"
        >
          <Play aria-hidden="true" strokeWidth={2.4} className="size-4" />
        </button>
      )}
    </div>
  )
}

function ListenStage({ workshop, onDone }: { workshop: Workshop; onDone: () => void }) {
  const t = useT().lesson.workshop
  const [playing, setPlaying] = useState<number | null>(null)
  /** Heard to the end once — or the audio is not there, and holding the learner here would be a trap. */
  const [heard, setHeard] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => () => {
    cancelled.current = true
  }, [])

  async function start() {
    cancelled.current = false
    workshop.lines.slice(0, 3).forEach((line) => void prefetchPromptAudio(line.speech, line.speaker))
    try {
      for (const line of workshop.lines) {
        if (cancelled.current) return
        const ahead = workshop.lines[line.index + 3]
        if (ahead) void prefetchPromptAudio(ahead.speech, ahead.speaker)
        setPlaying(line.index)
        await playLine(line)
      }
    } catch {
      // No clip: the dialogue is still on the screen to read.
    } finally {
      if (!cancelled.current) setHeard(true)
      setPlaying(null)
    }
  }

  function stop() {
    cancelled.current = true
    stopPromptAudio()
    setPlaying(null)
  }

  const running = playing !== null
  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">{t.listenBody}</p>
      <div className="grid gap-3">
        {workshop.lines.map((line) => <Bubble key={line.index} line={line} lit={playing === line.index} />)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button variant={heard ? 'secondary' : 'primary'} size="lg" onClick={() => (running ? stop() : void start())}>
          {running
            ? <><Square aria-hidden="true" strokeWidth={0} className="size-4 fill-current" /> {t.listenStop}</>
            : <><Headphones aria-hidden="true" className="size-5" /> {heard ? t.listenAgain : t.listenStart}</>}
        </Button>
        {heard && <Button size="lg" onClick={onDone}>{t.next}</Button>}
      </div>
    </div>
  )
}

function OrderStage({ workshop, placed, onPlaced, onDone }: {
  workshop: Workshop
  placed: number
  onPlaced: (firstTry: boolean) => void
  onDone: () => void
}) {
  const t = useT().lesson.workshop
  /** A wrong tap on the line being looked for; it stops counting as right on the first try. */
  const [missed, setMissed] = useState(false)
  const [wrong, setWrong] = useState<number | null>(null)
  const expected = workshop.ordering[placed]
  const left = workshop.shuffled.filter((index) => index >= placed)
  const finished = placed >= workshop.ordering.length

  function tap(index: number) {
    // Two lines with the same words are the same answer.
    if (expected && workshop.lines[index].text === expected.text) {
      playUiSound('correct')
      onPlaced(!missed)
      setMissed(false)
      setWrong(null)
      return
    }
    playUiSound('wrong')
    setMissed(true)
    setWrong(index)
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">{t.orderBody}</p>
      {placed > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-black tracking-[.12em] text-ink-faint uppercase">{t.orderPlaced}</p>
          <div className="grid gap-3">
            {workshop.ordering.slice(0, placed).map((line) => <Bubble key={line.index} line={line} />)}
          </div>
        </div>
      )}
      {!finished && (
        <>
          <p className="mb-2 text-[10px] font-black tracking-[.12em] text-ink-faint uppercase">
            {t.orderLeft} · {fill(t.itemOf, { n: placed + 1, total: workshop.ordering.length })}
          </p>
          <div className="grid gap-2">
            {left.map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => tap(index)}
                className={cx(
                  'raised raised-sm rounded-2xl border-2 bg-ground-raised px-3.5 py-2.5 text-left text-sm leading-relaxed text-ink sm:text-base',
                  wrong === index ? 'border-danger' : 'border-hairline hover:border-signal',
                )}
              >
                <RussianText text={workshop.lines[index].text} />
              </button>
            ))}
          </div>
          {wrong !== null && <p role="status" className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">{t.orderWrong}</p>}
        </>
      )}
      {finished && (
        <div className="mt-4 text-center">
          <p role="status" className="mb-3 text-sm font-black text-milestone">{t.correct}</p>
          <Button size="lg" onClick={onDone}>{t.next}</Button>
        </div>
      )}
    </div>
  )
}

/** Stages 3–5: one item at a time, three options, as many tries as it takes. */
function ChoiceStage<Item extends ChoiceItem>({ items, index, body, wrongNote, wordOptions = false, prompt, onAnswered, onNext, onDone }: {
  items: Item[]
  index: number
  body: string
  wrongNote: string
  /** Single words rather than sentences: laid out in a row. */
  wordOptions?: boolean
  prompt: (item: Item, solved: boolean) => ReactNode
  onAnswered: (firstTry: boolean) => void
  onNext: () => void
  onDone: () => void
}) {
  const t = useT().lesson.workshop
  const item = items[index]
  const [tried, setTried] = useState<number[]>([])
  const [solved, setSolved] = useState(false)

  // A lesson too short to build this stage from has nothing to ask here.
  const empty = items.length === 0
  useEffect(() => {
    if (empty) onDone()
    // Runs once for an empty stage; onDone is stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty])
  if (!item) return null

  const last = index >= items.length - 1

  function pick(option: number) {
    if (solved || tried.includes(option)) return
    if (option === item.correct) {
      playUiSound('correct')
      setSolved(true)
      onAnswered(tried.length === 0)
      return
    }
    playUiSound('wrong')
    setTried((current) => [...current, option])
  }

  function advance() {
    setTried([])
    setSolved(false)
    if (last) onDone()
    else onNext()
  }

  return (
    <div>
      <p className="mb-3 flex items-baseline justify-between gap-3 text-sm text-ink-muted">
        <span>{body}</span>
        <span className="shrink-0 font-black tabular-nums text-ink-faint">{fill(t.itemOf, { n: index + 1, total: items.length })}</span>
      </p>
      {prompt(item, solved)}
      <div className={cx('mt-4 grid gap-2', wordOptions && 'grid-cols-3')}>
        {item.options.map((option, position) => {
          const isWrong = tried.includes(position)
          const isRight = solved && position === item.correct
          return (
            <button
              key={`${index}-${position}`}
              type="button"
              disabled={isWrong || (solved && !isRight)}
              onClick={() => pick(position)}
              className={cx(
                'raised raised-sm rounded-2xl border-2 px-3.5 py-3 text-sm leading-relaxed sm:text-base',
                wordOptions ? 'text-center font-black' : 'text-left',
                isRight
                  ? 'border-milestone bg-milestone-soft text-milestone'
                  : isWrong
                    ? 'border-danger bg-danger-soft text-danger opacity-70'
                    : 'border-hairline bg-ground-raised text-ink hover:border-signal disabled:opacity-50',
              )}
            >
              <RussianText text={option} />
            </button>
          )
        })}
      </div>
      {!solved && tried.length > 0 && (
        <p role="status" className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">{wrongNote}</p>
      )}
      {solved && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p role="status" className="text-sm font-black text-milestone">{t.correct}</p>
          <Button onClick={advance}>{last ? t.next : t.nextItem}</Button>
        </div>
      )}
    </div>
  )
}

function preferredRecordingMimeType() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ''
}

function ReadStage({ workshop, read, micSkipped, onRead, onSkipMic, onRecorded, reviewed, onDone }: {
  workshop: Workshop
  read: number[]
  micSkipped: boolean
  /** The center's teacher listens to these recordings; the learner is told before recording. */
  reviewed: boolean
  onRead: (index: number) => void
  onSkipMic: () => void
  onRecorded?: (line: WorkshopLine, audio: Blob) => void
  onDone: () => void
}) {
  const t = useT().lesson.workshop
  const [position, setPosition] = useState(() => {
    const next = workshop.reading.findIndex((line) => !read.includes(line.index))
    return next < 0 ? workshop.reading.length - 1 : next
  })
  const line = workshop.reading[position]
  const [recording, setRecording] = useState(false)
  const [micError, setMicError] = useState(false)
  /** The learner's own takes, by line. Kept for this visit only: they are for the ear, not for storage. */
  const takes = useRef(new Map<number, string>())
  const [hasTake, setHasTake] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mine = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const urls = takes.current
    return () => {
      const recorder = recorderRef.current
      if (recorder?.state === 'recording') {
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      mine.current?.pause()
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    setHasTake(takes.current.has(line.index))
  }, [line.index])

  function playMine() {
    const url = takes.current.get(line.index)
    if (!url) return Promise.resolve()
    stopPromptAudio()
    mine.current?.pause()
    const audio = new Audio(url)
    mine.current = audio
    return new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      void audio.play().catch(() => resolve())
    })
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = preferredRecordingMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      const chunks: Blob[] = []
      const target = line
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        setRecording(false)
        recorderRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        if (audio.size === 0) return
        const previous = takes.current.get(target.index)
        if (previous) URL.revokeObjectURL(previous)
        takes.current.set(target.index, URL.createObjectURL(audio))
        setHasTake(true)
        onRead(target.index)
        onRecorded?.(target, audio)
        // The model, then the learner, back to back: the comparison is the exercise.
        void playLine(target).catch(() => {}).then(() => playMine())
      }
      stopPromptAudio()
      mine.current?.pause()
      setMicError(false)
      recorder.start()
      setRecording(true)
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setRecording(false)
      setMicError(true)
    }
  }

  const done = read.includes(line.index) || micSkipped
  const last = position >= workshop.reading.length - 1

  function advance() {
    if (micSkipped) onRead(line.index)
    if (last) onDone()
    else setPosition(position + 1)
  }

  return (
    <div>
      <p className="mb-3 flex items-baseline justify-between gap-3 text-sm text-ink-muted">
        <span>{t.readBody}</span>
        <span className="shrink-0 font-black tabular-nums text-ink-faint">{fill(t.itemOf, { n: position + 1, total: workshop.reading.length })}</span>
      </p>
      <Bubble line={line} />

      <div className="mt-5 flex items-start justify-center gap-6">
        <RoundAction label={t.listenModel} onClick={() => void playLine(line).catch(() => {})}>
          <Headphones aria-hidden="true" strokeWidth={1.9} className="size-6" />
        </RoundAction>
        {!micSkipped && (
          <RoundAction
            label={recording ? t.stop : hasTake ? t.recordAgain : t.record}
            tone={recording ? 'danger' : 'signal'}
            onClick={() => void toggleRecording()}
          >
            {recording
              ? <Square aria-hidden="true" strokeWidth={0} className="size-5 fill-current" />
              : <Mic aria-hidden="true" strokeWidth={2} className="size-6" />}
          </RoundAction>
        )}
        {hasTake && !recording && (
          <RoundAction label={t.playMine} onClick={() => void playMine()}>
            <Play aria-hidden="true" strokeWidth={2.2} className="size-6" />
          </RoundAction>
        )}
      </div>

      {reviewed && !micSkipped && <p className="mt-3 text-center text-xs text-ink-faint">{t.teacherSends}</p>}
      {micError && <p role="status" className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">{t.micDenied}</p>}
      {micSkipped && <p className="mt-3 rounded-xl bg-ground-sunken p-3 text-sm text-ink-muted">{t.noMicNote}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {!micSkipped
          ? <Button variant="ghost" onClick={onSkipMic}>{t.noMic}</Button>
          : <span />}
        <Button disabled={!done || recording} onClick={advance}>{last ? t.next : t.nextLine}</Button>
      </div>
    </div>
  )
}

function RoundAction({ label, tone = 'soft', onClick, children }: {
  label: string
  tone?: 'soft' | 'signal' | 'danger'
  onClick: () => void
  children: ReactNode
}) {
  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cx(
          'raised flex size-16 shrink-0 items-center justify-center rounded-full',
          tone === 'signal' && 'bg-signal text-on-signal',
          tone === 'danger' && 'bg-danger text-white',
          tone === 'soft' && 'raised-signal-soft bg-signal-soft text-signal-ink',
        )}
      >
        {children}
      </button>
      <span aria-hidden="true" className="text-center text-xs font-bold text-ink-muted">{label}</span>
    </div>
  )
}
