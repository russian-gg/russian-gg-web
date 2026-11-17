import { useEffect, useRef, useState } from 'react'
import { Headphones, Mic, ShieldCheck, Star, type LucideIcon } from 'lucide-react'
import { cx } from '../../src/lib/cx'
import { adminFetch, formatDateTime, useAdminQuery } from '../lib/api'
import type { CenterOverview, CenterRecording } from '../lib/center-types'
import {
  Button,
  ConfirmDialog,
  ErrorNote,
  LoadingRows,
  PageHeader,
  Screen,
  Tabs,
  Textarea,
} from '../components/ui'
import { toast } from '../lib/toast'

/*
 * Teacher review. A center that turns it on has its students read dialogue lines aloud in their
 * lessons; every recording lands in the queue here, and the teacher listens and leaves a mark
 * from 1 to 5 with an optional comment, which the student then sees in the lesson. A person does
 * the listening — nothing on this page is scored by AI.
 */

const BASE = '/api/center-portal'

/** The audio links are signed for 30 minutes, so the lists are asked for again well before that. */
const RELOAD_MS = 20 * 60_000

const MARKS = [1, 2, 3, 4, 5] as const

/** What each mark says, shown beside the buttons so a number is never chosen blind. */
const MARK_WORDS: Record<number, string> = {
  1: 'Tushunarsiz',
  2: 'Zaif',
  3: "O'rtacha",
  4: 'Yaxshi',
  5: "A'lo",
}

type Tab = 'waiting' | 'reviewed'

export function CenterReviewScreen() {
  const overview = useAdminQuery<CenterOverview>(`${BASE}/overview`)

  return (
    <Screen className="space-y-6">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Tekshirish"
          subtitle="O'quvchilar darsda ovoz chiqarib o'qigan replikalar. Tinglang, baho qo'ying — o'quvchi bahoni darsda ko'radi."
        />

        {overview.error && <ErrorNote onRetry={overview.refresh}>{overview.error}</ErrorNote>}
        {!overview.data && !overview.error && <LoadingRows rows={3} />}

        {overview.data &&
          (overview.data.teacherReview ? (
            <Queue waitingCount={overview.data.recordingsWaiting} onChanged={overview.refresh} />
          ) : (
            <TurnOnCard onChanged={overview.refresh} />
          ))}
      </div>
    </Screen>
  )
}

/** Switches review on or off. The answer is the new overview, which the caller asks for again. */
async function setTeacherReview(enabled: boolean) {
  await adminFetch<CenterOverview>(`${BASE}/teacher-review`, { method: 'POST', body: JSON.stringify({ enabled }) })
}

/**
 * What the page is while review is off: what turning it on does, and — because a recording of a
 * student's voice is the thing being asked for — that nothing leaves the device until then.
 */
function TurnOnCard({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function turnOn() {
    setBusy(true)
    setFailure('')
    try {
      await setTeacherReview(true)
      toast('Tekshirish yoqildi')
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Tekshirishni yoqib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="review-off-title"
      className="overflow-hidden rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised"
    >
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* What it is and the one button, on the left: this page has a single decision on it. */}
        <div className="flex flex-col items-start gap-4 p-6 sm:p-8">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-2xl bg-signal-soft text-signal-ink"
          >
            <Headphones className="size-7" strokeWidth={1.7} />
          </span>
          <div>
            <h2 id="review-off-title" className="text-2xl leading-tight font-extrabold tracking-tight text-ink">
              O'quvchilaringiz qanday gapirayotganini eshiting
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
              Yoqilganda o'quvchilarning darsda ovoz chiqarib o'qigan replikalari shu yerga keladi. Siz tinglaysiz va baho
              qo'yasiz — hech qanday sun'iy intellekt ishtirok etmaydi.
            </p>
          </div>
          {failure && <ErrorNote>{failure}</ErrorNote>}
          <Button disabled={busy} onClick={() => void turnOn()}>
            {busy ? 'Yoqilmoqda…' : 'Tekshirishni yoqish'}
          </Button>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
            <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0 text-milestone" strokeWidth={1.9} />
            O'chiq turganda hech qanday yozuv o'quvchining qurilmasidan chiqmaydi.
          </p>
        </div>

        {/* How it goes, on the right — and what one recording will look like once they arrive. */}
        <div className="space-y-5 border-t-2 border-hairline bg-ground-sunken/60 p-6 sm:p-8 lg:border-t-0 lg:border-l-2">
          <p className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">Qanday ishlaydi</p>
          <ol className="space-y-4">
            <HowStep n={1} Icon={Mic} title="O'quvchi o'qiydi">
              Darsdagi dialog replikalarini ovoz chiqarib o'qiydi va yozib oladi.
            </HowStep>
            <HowStep n={2} Icon={Headphones} title="Siz tinglaysiz">
              Yozuvlar guruhlar bo'yicha shu sahifaga, navbat bilan keladi.
            </HowStep>
            <HowStep n={3} Icon={Star} title="Baho va izoh qo'yasiz">
              1 dan 5 gacha baho va qisqa izoh — o'quvchi ularni o'sha darsning o'zida ko'radi.
            </HowStep>
          </ol>
        </div>
      </div>
    </section>
  )
}

function HowStep({ n, Icon, title, children }: { n: number; Icon: LucideIcon; title: string; children: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-hairline bg-ground-raised text-signal-ink">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-ink">
          <span className="mr-1.5 text-ink-faint tabular-nums">{n}.</span>
          {title}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{children}</p>
      </div>
    </li>
  )
}

/** A recording with no group still needs a chip of its own once other recordings have one. */
const NO_GROUP = '\u0000'
const ALL_GROUPS = ''

function Queue({ waitingCount, onChanged }: { waitingCount: number; onChanged: () => void }) {
  const waiting = useAdminQuery<CenterRecording[]>(`${BASE}/recordings?reviewed=false`)
  const reviewed = useAdminQuery<CenterRecording[]>(`${BASE}/recordings?reviewed=true`)
  const [tab, setTab] = useState<Tab>('waiting')
  const [group, setGroup] = useState(ALL_GROUPS)
  const [askingOff, setAskingOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const refreshWaiting = waiting.refresh
  const refreshReviewed = reviewed.refresh

  /*
   * Coming back to the tab and a slow timer both ask again: the first so recordings made in the
   * meantime show up, the second so a page left open never plays from an expired link.
   */
  useEffect(() => {
    const reload = () => {
      refreshWaiting()
      refreshReviewed()
      onChanged()
    }
    window.addEventListener('focus', reload)
    const timer = window.setInterval(reload, RELOAD_MS)
    return () => {
      window.removeEventListener('focus', reload)
      window.clearInterval(timer)
    }
  }, [refreshWaiting, refreshReviewed, onChanged])

  // A mark moves a recording from one list to the other and changes the count in the overview.
  const afterSave = () => {
    refreshWaiting()
    refreshReviewed()
    onChanged()
  }

  async function turnOff() {
    setBusy(true)
    setFailure('')
    try {
      await setTeacherReview(false)
      toast("Tekshirish o'chirildi")
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Tekshirishni o'chirib bo'lmadi.")
      setAskingOff(false)
    } finally {
      setBusy(false)
    }
  }

  const list = tab === 'waiting' ? waiting : reviewed
  const groupKeys = [...new Set((list.data ?? []).map((item) => item.groupName ?? NO_GROUP))]
  // The chosen group can vanish — its last recording was marked — and then everything is shown.
  const activeGroup = groupKeys.includes(group) ? group : ALL_GROUPS
  const shown = (list.data ?? []).filter((item) => activeGroup === ALL_GROUPS || (item.groupName ?? NO_GROUP) === activeGroup)
  // The list itself is the truer count once it has loaded; the overview's covers the wait.
  const waitingTotal = waiting.data ? waiting.data.length : waitingCount

  return (
    <>
      <div className="flex flex-col gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'waiting', label: waitingTotal > 0 ? `Kutilmoqda · ${waitingTotal}` : 'Kutilmoqda' },
            { id: 'reviewed', label: 'Tekshirilgan' },
          ]}
        />

        {groupKeys.length > 1 && (
          <div role="group" aria-label="Guruh bo'yicha" className="flex flex-wrap gap-2">
            {[ALL_GROUPS, ...groupKeys].map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={activeGroup === key}
                onClick={() => setGroup(key)}
                className={cx(
                  'inline-flex h-9 items-center rounded-[var(--radius-control)] border-2 px-3.5 text-sm font-bold transition-colors',
                  activeGroup === key
                    ? 'border-ink bg-ink text-ground-raised'
                    : 'border-hairline bg-ground-raised text-ink-muted hover:border-ink-faint hover:text-ink',
                )}
              >
                {key === ALL_GROUPS ? 'Barchasi' : key === NO_GROUP ? 'Guruhsiz' : key}
              </button>
            ))}
          </div>
        )}
      </div>

      {list.error && <ErrorNote onRetry={list.refresh}>{list.error}</ErrorNote>}
      {!list.data && !list.error && <LoadingRows rows={3} />}
      {list.data && shown.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-hairline bg-ground-raised px-6 py-12 text-center">
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-ground-sunken text-ink-faint">
            <Headphones className="size-7" strokeWidth={1.6} />
          </span>
          <p className="text-base font-extrabold text-ink">
            {tab === 'waiting' ? "Hozircha tekshiriladigan yozuv yo'q" : "Hali tekshirilgan yozuv yo'q"}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-ink-muted">
            {tab === 'waiting'
              ? "O'quvchilar darsdagi dialogni ovoz chiqarib o'qiganda, yozuvlari shu yerda paydo bo'ladi."
              : "Baho qo'ygan yozuvlaringiz shu yerda saqlanadi — bahoni keyin o'zgartirish ham mumkin."}
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="grid gap-4 2xl:grid-cols-2">
          {shown.map((recording) => (
            <li key={recording.id}>
              <RecordingCard recording={recording} onSaved={afterSave} />
            </li>
          ))}
        </ul>
      )}

      {failure && <ErrorNote>{failure}</ErrorNote>}

      {/* Last and quiet: it is rarely wanted, and never by accident. */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setAskingOff(true)}>
          Tekshirishni o'chirish
        </Button>
      </div>

      {askingOff && (
        <ConfirmDialog
          title="Tekshirishni o'chirish"
          body="O'chirilsa, yangi yozuvlar kelmaydi. Mavjud yozuvlar saqlanadi."
          confirmLabel="O'chirish"
          busy={busy}
          onConfirm={() => void turnOff()}
          onCancel={() => setAskingOff(false)}
        />
      )}
    </>
  )
}

/**
 * One recording: who read what, the player, and the mark. The same controls serve both lists —
 * in the reviewed one they start from the mark already given, and saving replaces it.
 */
function RecordingCard({ recording, onSaved }: { recording: CenterRecording; onSaved: () => void }) {
  const [mark, setMark] = useState<number | null>(recording.mark)
  const [comment, setComment] = useState(recording.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const isReviewed = recording.mark !== null
  // Nothing to save until a mark is chosen, or — on a reviewed one — until something differs.
  const changed = mark !== recording.mark || comment.trim() !== (recording.comment ?? '')
  const canSave = mark !== null && changed && !busy

  async function save() {
    if (mark === null) return
    setBusy(true)
    setFailure('')
    try {
      const text = comment.trim()
      await adminFetch<void>(`${BASE}/recordings/${recording.id}`, {
        method: 'PATCH',
        body: JSON.stringify(text ? { mark, comment: text } : { mark }),
      })
      toast(isReviewed ? 'Baho yangilandi' : 'Baho saqlandi')
      onSaved()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Bahoni saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const meta = [
    recording.groupName,
    recording.courseDay !== null ? `${recording.courseDay}-dars` : null,
    formatDateTime(recording.recordedAt),
  ].filter(Boolean)

  return (
    <article className="grid overflow-hidden rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised md:grid-cols-[minmax(0,1fr)_300px]">
      {/* Who read what, and the recording: everything the teacher needs before deciding. */}
      <div className="min-w-0 space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-signal-soft text-base font-extrabold text-signal-ink uppercase"
          >
            {recording.studentName.trim().charAt(0) || '?'}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-ink">{recording.studentName}</h3>
            <p className="truncate text-xs text-ink-muted tabular-nums">{meta.join(' · ')}</p>
          </div>
        </div>

        <blockquote lang="ru" className="rounded-2xl bg-ground-sunken px-4 py-3 text-lg leading-snug font-bold break-words text-ink">
          {recording.lineText}
        </blockquote>

        <Player url={recording.audioUrl} />
      </div>

      {/* The decision, on its own side: a mark, a word about it, save. */}
      <div className="space-y-3 border-t-2 border-hairline bg-ground-sunken/50 p-5 md:border-t-0 md:border-l-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">Baho</p>
          <p className="text-sm font-bold text-ink">{mark === null ? 'Tanlang' : MARK_WORDS[mark]}</p>
        </div>
        <div role="group" aria-label="Baho" className="grid grid-cols-5 gap-1.5">
          {MARKS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mark === value}
              aria-label={`${value} baho — ${MARK_WORDS[value]}`}
              onClick={() => setMark(value)}
              className={cx(
                'h-11 rounded-xl border-2 text-base font-extrabold tabular-nums transition-colors',
                mark === value
                  ? 'border-signal bg-signal text-on-signal'
                  : 'border-hairline bg-ground-raised text-ink-muted hover:border-ink-faint hover:text-ink',
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Izoh (ixtiyoriy) — o'quvchi ko'radi"
          aria-label="Izoh"
          className="min-h-0"
        />
        <Button block disabled={!canSave} onClick={() => void save()}>
          {busy ? 'Saqlanmoqda…' : isReviewed ? 'Bahoni yangilash' : 'Saqlash'}
        </Button>
        {isReviewed && (
          <p className="text-xs text-ink-muted">
            {[recording.reviewedBy, recording.reviewedAt && formatDateTime(recording.reviewedAt)].filter(Boolean).join(' · ')}
          </p>
        )}
        {failure && <ErrorNote>{failure}</ErrorNote>}
      </div>
    </article>
  )
}

/**
 * The browser's own player. Every refetch brings a freshly signed link for the same recording,
 * and handing a new `src` to an `<audio>` restarts it — so the link is only swapped while the
 * player is at rest, and again when a play-through ends. Saving a mark on one recording must not
 * cut off the next one the teacher has already started.
 */
function Player({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [src, setSrc] = useState(url)

  useEffect(() => {
    const audio = ref.current
    if (!audio || url === src) return
    if (audio.paused && (audio.currentTime === 0 || audio.ended)) setSrc(url)
  }, [url, src])

  return <audio ref={ref} controls preload="none" src={src} onEnded={() => setSrc(url)} className="w-full" />
}
