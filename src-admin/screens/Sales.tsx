import { useEffect, useMemo, useRef, useState } from 'react'
import { adminFetch, formatDate, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import { useStickyTab } from '../lib/sticky-tab'
import type {
  ChatSender,
  SalesChat,
  SalesDashboard as SalesDashboardData,
  SalesChatPage,
  SalesChatSummary,
  SalesDemo,
  SalesFolder,
  SalesUnread,
  SalesSettings,
  SalesUserStatus,
} from '../lib/types'
import {
  Badge,
  Button,
  Card,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  PeriodToggle,
  SectionHeading,
  Stat,
  Tabs,
} from '../components/ui'
import { BarList, ColumnChart } from '../components/charts'
import { cx } from '../../src/lib/cx'
import { playIncomingChime, soundMuted } from '../lib/notify'

const statusLabel: Record<SalesUserStatus, string> = {
  Unregistered: "Ro'yxatdan o'tmagan",
  Registered: "Ro'yxatdan o'tgan",
  DroppedAtPaywall: "To'lov sahifasida to'xtagan",
  AbandonedCheckout: "To'lovni tugatmagan",
  Trialing: 'Sinov muddatida',
  TrialExpired: 'Sinov tugagan',
  Paid: 'Obunachi',
}

/*
 * The colour is the sales priority, not decoration. An expired trial and an abandoned checkout
 * are the two conversations worth having today — they have used the product and stopped at the
 * price — so they carry the one colour that draws the eye.
 */
const statusTone = {
  Unregistered: 'neutral',
  Registered: 'neutral',
  DroppedAtPaywall: 'caution',
  AbandonedCheckout: 'caution',
  Trialing: 'signal',
  TrialExpired: 'caution',
  Paid: 'milestone',
} as const

const SALES_TABS = ['dashboard', 'inbox', 'demos', 'settings'] as const

/** How many chats a page of the inbox holds, and how many each press of "more" adds. */
const PAGE = 20

/*
 * Four folders, because an operator only ever has four questions about this list: what is
 * waiting, what is close to money, what else is there, and what is done with. Anything finer
 * becomes a filter menu nobody opens.
 */
const FOLDERS = ['New', 'Hot', 'All', 'Archived'] as const

const FOLDER_TABS: Array<{ id: SalesFolder; label: string }> = [
  { id: 'New', label: 'Yangilar' },
  { id: 'Hot', label: 'Issiq' },
  { id: 'All', label: 'Hammasi' },
  { id: 'Archived', label: 'Arxiv' },
]

/** The count rides on Yangilar, which is the folder it describes. */
const foldersWithBadge = (waiting: number) =>
  FOLDER_TABS.map((tab) => (tab.id === 'New' ? { ...tab, badge: waiting } : tab))

/** Each folder is empty for its own reason, and saying which one is the whole value. */
const EMPTY: Record<SalesFolder, string> = {
  New: "Javob kutayotgan xabar yo'q — hammasi o'qilgan.",
  Hot: "Hozircha sotib olishga yaqin suhbat yo'q.",
  All: "Hali suhbat yo'q. Bot sozlangach, unga yozilgan birinchi xabar shu yerda paydo bo'ladi.",
  Archived: "Arxivda hech narsa yo'q.",
}

export function Sales() {
  const [tab, setTab] = useStickyTab('sales', SALES_TABS)

  /*
   * Asked for from here rather than from the inbox, because the badge has to be right on the
   * two tabs where the inbox is not mounted — that is the entire point of it. Its own endpoint
   * for the same reason: it is polled from every tab, and the chat list is far heavier.
   */
  const { data: unread, refresh } = useAdminQuery<SalesUnread>('/api/admin-portal/sales/unread')

  useEffect(() => {
    const timer = window.setInterval(refresh, 5000)

    return () => window.clearInterval(timer)
  }, [refresh])

  return (
    <div className="space-y-6">
      <PageHeader title="Sotuv (Telegram)" subtitle="Bot yuritayotgan suhbatlar va sotuv agenti" />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'dashboard', label: 'Sotuv paneli' },
          // Conversations waiting, not messages: five from one person is one thing to answer.
          { id: 'inbox', label: 'Suhbatlar', badge: unread?.chats },
          { id: 'demos', label: 'Demolar' },
          { id: 'settings', label: 'Agent sozlamalari' },
        ]}
      />

      {tab === 'dashboard' && <SalesDashboardTab />}
      {tab === 'inbox' && <Inbox waiting={unread?.chats ?? 0} />}
      {tab === 'demos' && <Demos />}
      {tab === 'settings' && <AgentSettings />}
    </div>
  )
}

function SalesDashboardTab() {
  const [days, setDays] = useState(30)
  const { data, error, isLoading } = useAdminQuery<SalesDashboardData>(
    `/api/admin-portal/sales/dashboard?days=${days}`,
  )

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const period = `${days} kunlik davr`
  const answered = data.averageReplySeconds

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PeriodToggle value={days} onChange={setDays} />
      </div>

      <section>
        <SectionHeading>Suhbatlar</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Jami suhbat"
            value={formatNumber(data.totalChats)}
            note={`+${formatNumber(data.newChats)} · ${period}`}
          />
          <Stat
            label="Faol suhbat"
            value={formatNumber(data.activeChats)}
            note={`${period} ichida yozganlar`}
          />
          <Stat
            label="Qo'lga olingan"
            value={formatNumber(data.handedOverChats)}
            note="AI o'chirilgan suhbatlar"
          />
          <Stat
            label="O'rtacha javob"
            value={answered === null || answered === undefined ? '—' : `${Math.round(answered)} s`}
            note={answered === null || answered === undefined ? 'Hali javob berilmagan' : 'Savoldan javobgacha'}
          />
        </div>
      </section>

      <section>
        <SectionHeading>Xabarlar</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Mijozlardan" value={formatNumber(data.customerMessages)} note={period} />
          <Stat label="AI javoblari" value={formatNumber(data.agentMessages)} note={period} />
          <Stat label="Operator javoblari" value={formatNumber(data.operatorMessages)} note={period} />
        </div>

        <Card className="mt-4">
          <h3 className="mb-3 text-base font-extrabold text-ink">Kunlik mijoz xabarlari</h3>
          <ColumnChart
            points={data.messagesByDay.map((day) => ({ date: day.label, value: day.value }))}
            label="Mijoz xabarlari"
            format={formatNumber}
          />
        </Card>
      </section>

      <section>
        <SectionHeading>Sotuvga yaqinlik</SectionHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-base font-extrabold text-ink">Baholar taqsimoti</h3>
            {/* In order, low to high. A scale sorted by size stops being a scale. */}
            <BarList items={data.readinessBands} format={formatNumber} labelWidth="w-28 sm:w-32" />
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-extrabold text-ink">Holati bo'yicha</h3>
            <BarList
              items={data.statuses.map((item) => ({
                label: statusLabel[item.label as SalesUserStatus] ?? item.label,
                value: item.value,
              }))}
              format={formatNumber}
              labelWidth="w-32 sm:w-44"
            />
          </Card>
        </div>
      </section>

      <section>
        <SectionHeading>Hisobga bog'lanish va to'lov</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Hisobga bog'langan"
            value={formatNumber(data.linkedChats)}
            note={`${formatNumber(data.totalChats - data.linkedChats)} tasi bog'lanmagan`}
          />
          <Stat
            label="Keyin to'laganlar"
            value={formatNumber(data.convertedChats)}
            note="Suhbat boshlangandan keyin"
          />
          <Card>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">AI sarfi</span>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">
              {formatNumber(data.aiTokens)}
            </div>
            <div className="text-sm text-ink-muted">
              {formatNumber(data.aiCalls)} ta chaqiruv
              {data.aiFailures > 0 && ` · ${formatNumber(data.aiFailures)} xato`}
            </div>
          </Card>
        </div>

        {/*
          Said where the number is. A conversation followed by a payment is not a payment the
          conversation caused — somebody who was going to buy anyway and happened to write
          first is counted here too, and nothing in this data can separate them.
        */}
        <p className="mt-3 text-xs text-ink-faint">
          "Keyin to'laganlar" — suhbat boshlangandan so'ng to'lov qilgan hisoblar soni. Bu
          to'lovni aynan suhbat keltirganini isbotlamaydi.
        </p>
      </section>
    </div>
  )
}

/**
 * @param waiting Conversations with something unread, for the badge on the folder.
 *
 * It matters more than it looks: the panel no longer jumps to a new arrival, so this is how an
 * operator finds out one happened while they were reading something else.
 */
function Inbox({ waiting }: { waiting: number }) {
  /*
   * How many of the most recently active chats to ask for. Growing this rather than paging
   * means the five-second refresh returns exactly what is already on screen plus anything new,
   * so nothing an operator has scrolled to disappears under them.
   */
  const [take, setTake] = useState(PAGE)
  const [folder, setFolder] = useStickyTab('sales-folder', FOLDERS)

  const { data, error, isLoading, refresh } = useAdminQuery<SalesChatPage | SalesChatSummary[]>(
    `/api/admin-portal/sales/chats?take=${take}&folder=${folder}`,
  )

  /*
   * Both shapes accepted. The panel and the API deploy separately, so for a few minutes on
   * every release one of them is older than the other — and this exact mismatch took the
   * admin down once already today.
   */
  const chats = useMemo(
    () => (Array.isArray(data) ? data : (data?.items ?? [])),
    [data],
  )
  const total = Array.isArray(data) ? data.length : (data?.total ?? chats.length)
  const [selected, setSelected] = useState<string | null>(null)
  const [muted, setMuted] = useState(soundMuted.get)
  const { shell, height } = useViewportHeight()

  /*
   * The last thing each chat said, from the previous poll. Held in a ref rather than state so
   * comparing against it does not itself cause a render — and seeded on the first load, so
   * opening the panel does not chime once for every conversation already in it.
   */
  const heard = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    if (!data) return

    const current = new Map(chats.map((chat) => [chat.id, chat.lastInteractionAt]))


    if (heard.current === null) {
      heard.current = current

      return
    }

    // One sound however many chats moved at once: five customers writing together is still
    // one thing to look up for.
    const somebodyWrote = chats.some(
      (chat) => chat.lastMessageFromUser && heard.current?.get(chat.id) !== chat.lastInteractionAt,
    )

    heard.current = current

    if (somebodyWrote) playIncomingChime()
  }, [chats, data])

  // A sales inbox that only updates when you press something is one nobody watches. Five
  // seconds is faster than a customer notices a delay and slower than it costs anything.
  useEffect(() => {
    const timer = window.setInterval(refresh, 5000)

    return () => window.clearInterval(timer)
  }, [refresh])

  /*
   * Opens the newest conversation on arrival, and then never moves on its own again.
   *
   * It used to re-select whenever the open chat left the visible list, which sounded careful
   * and was the opposite. The default folder is Yangilar, and opening a conversation is what
   * marks it read — so five seconds later it left that folder, this fired, and the panel
   * jumped to somebody else while the operator was still reading. A new arrival taking the top
   * of the list did the same thing.
   *
   * The conversation pane loads by id and does not need the chat to be in the list, so there
   * is nothing to fix when it leaves one. Only a person clicking a row changes what is open.
   */
  useEffect(() => {
    if (selected === null && chats.length > 0) setSelected(chats[0].id)
  }, [chats, selected])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  if (chats.length === 0) {
    return (
      <div className="space-y-3">
        <Tabs value={folder} onChange={setFolder} options={foldersWithBadge(waiting)} />
        <Card>
          <EmptyNote>{EMPTY[folder]}</EmptyNote>
        </Card>
      </div>
    )
  }

  return (
    <div
      ref={shell}
      style={height ? { height } : undefined}
      className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
    >
      {/*
        Its own scroll, so reading down the list leaves the open conversation exactly where it
        was. Before this the whole page moved and the thread went with it — which is not how
        any messenger behaves, and it is disorienting for the same reason.
      */}
      <div className="min-h-0 space-y-2 lg:overflow-y-auto lg:pr-1">
        {/*
          Pinned to the top of the column, not scrolled with it. The folders are how you change
          what the list is showing, and having to scroll back up to reach them is the one thing
          a folder switch must never ask for. The background is the page's own, so rows pass
          underneath rather than through.
        */}
        <div className="sticky top-0 z-10 -mt-1 space-y-2 bg-ground-sunken pt-1 pb-1">
          <Tabs value={folder} onChange={setFolder} options={foldersWithBadge(waiting)} />
        {/* A line rather than a section heading: it is a count and a toggle, and on a short
            window every row it costs is a conversation not on screen. */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs">
          <span className="font-bold text-ink-faint">
            {formatNumber(chats.length)} / {formatNumber(total)}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !muted
              setMuted(next)
              soundMuted.set(next)
              // Played on unmuting, which both confirms the choice and is the user gesture
              // browsers want before they will let a page make a sound at all.
              if (!next) playIncomingChime()
            }}
            className="font-bold text-signal-ink"
          >
            {muted ? "Ovoz o'chirilgan" : 'Ovoz yoqilgan'}
          </button>
          </div>
        </div>
        {chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => setSelected(chat.id)}
            className={cx(
              'block w-full rounded-[var(--radius-card)] border-2 px-3.5 py-2.5 text-left transition-colors',
              selected === chat.id
                ? 'border-signal bg-signal-soft/40'
                : 'border-hairline bg-ground-raised hover:border-ink-faint',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cx(
                  'min-w-0 truncate text-sm text-ink',
                  // Unread is heavier as well as counted, so the row reads as waiting at a
                  // glance rather than only under the number.
                  chat.unread > 0 ? 'font-black' : 'font-extrabold',
                )}
              >
                {chat.displayName}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {!chat.aiAutoReply && <Badge>Qo'lda</Badge>}
                {chat.unread > 0 && (
                  <span
                    aria-label={`${chat.unread} ta o'qilmagan xabar`}
                    className="min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[11px] leading-none font-extrabold text-on-danger"
                  >
                    {chat.unread > 99 ? '99+' : chat.unread}
                  </span>
                )}
              </span>
            </div>

            <p
              className={cx(
                'mt-1 truncate text-sm',
                chat.unread > 0 ? 'font-bold text-ink' : 'text-ink-muted',
              )}
            >
              {chat.lastMessageFromUser ? '' : '↩ '}
              {chat.lastMessage ?? '—'}
            </p>

            {/*
              One line instead of four. The label and the signal moved into the tooltip and the
              bar shrank to a rule under the row: on a laptop running Windows the list was
              showing three conversations, and a caption repeating "sotib olishga yaqinlik"
              against every one of them was most of what it was spending the height on.
            */}
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone={statusTone[chat.status]}>{statusLabel[chat.status]}</Badge>
              <Readiness value={chat.readiness} signal={chat.readinessSignal} />
              <span className="ml-auto shrink-0 text-xs text-ink-faint">
                {formatDate(chat.lastInteractionAt)}
              </span>
            </div>
          </button>
        ))}

        {chats.length < total && (
          <button
            type="button"
            onClick={() => setTake((current) => current + PAGE)}
            className="w-full rounded-[var(--radius-card)] border-2 border-hairline py-2.5 text-sm font-bold text-signal-ink transition-colors hover:border-ink-faint"
          >
            Yana {formatNumber(Math.min(PAGE, total - chats.length))} ta
          </button>
        )}
      </div>

      {selected && <Conversation chatId={selected} onChanged={refresh} />}
    </div>
  )
}

/**
 * How tall the inbox should be so that it ends at the bottom of the window.
 *
 * Measured rather than guessed at with a calc(): the header above it is a different height in
 * every language and wraps at some widths, and a constant that is wrong by twenty pixels is
 * either a scrollbar nobody wants or a composer cut off the bottom of the screen.
 *
 * Only from `lg`. On a phone the two panes are stacked and there is no room to pin either.
 */
function useViewportHeight() {
  /*
   * A callback ref held in state, not a useRef.
   *
   * The inbox renders a spinner until the chats arrive, so on mount there is no element to
   * measure — and an effect that runs once, with an empty dependency list, measured null and
   * never ran again. The height was therefore never applied and the pane grew to the length of
   * the conversation, which is the bug this hook exists to prevent.
   */
  const [shell, setShell] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState<number>()

  useEffect(() => {
    if (!shell) return

    const measure = () => {
      if (!window.matchMedia('(min-width: 1024px)').matches) {
        setHeight(undefined)

        return
      }

      // 24px of air below, so the pane does not sit flush against the window edge.
      setHeight(Math.max(360, window.innerHeight - shell.getBoundingClientRect().top - 24))
    }

    measure()
    window.addEventListener('resize', measure)

    return () => window.removeEventListener('resize', measure)
  }, [shell])

  return { shell: setShell, height }
}

function Conversation({ chatId, onChanged }: { chatId: string; onChanged: () => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<SalesChat>(
    `/api/admin-portal/sales/chats/${chatId}`,
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [situation, setSituation] = useState('')
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoSent, setDemoSent] = useState(false)
  const [offerSent, setOfferSent] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(refresh, 4000)

    return () => window.clearInterval(timer)
  }, [refresh])

  // A conversation is read at the bottom: that is where the message somebody is answering is.
  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [data?.messages.length])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const { chat, user, messages } = data

  async function act(path: string, body?: unknown) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/sales/chats/${chatId}${path}`, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text) return

    setDraft('')
    await act('/messages', { text })
  }

  /**
   * Builds the minute and sends the link, right now rather than through the queue: somebody
   * who pressed a button is owed an answer about whether it worked.
   */
  async function archive(next: boolean) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/sales/chats/${chatId}/archive?archived=${next}`, {
        method: 'POST',
      })

      // The list owns which chats are on which shelf, and this one just moved.
      onChanged()
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  async function sendOffer() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/sales/chats/${chatId}/offer`, { method: 'POST' })

      setOfferSent(true)
      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Yuborilmadi')
    } finally {
      setBusy(false)
    }
  }

  async function sendDemo() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/sales/chats/${chatId}/demo`, {
        method: 'POST',
        body: JSON.stringify({ situation: situation.trim() }),
      })

      setSituation('')
      setDemoOpen(false)
      setDemoSent(true)
      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Demo yuborilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cx(
        'grid min-h-0 gap-4 overflow-hidden',
        // The card is a column of facts about an account. With no account there are no facts,
        // and a panel that exists only to say so is width the conversation should have had —
        // which is most of them, because people write to the bot before they sign up.
        user.userId && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]',
      )}
    >
      <Card className="flex min-h-0 flex-col lg:overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-hairline pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-ink">{chat.displayName}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xs text-ink-faint">
                {chat.username ? `@${chat.username}` : `#${chat.chatId}`}
              </p>
              {/* Kept when the card is not shown, because "have they signed up" is the one
                  thing about them that changes how this conversation should go. */}
              <Badge tone={statusTone[user.status]}>{statusLabel[user.status]}</Badge>
            </div>
          </div>

          {/*
            The one control that decides who is answering. Turning it back on after a handover
            is deliberate — nothing turns it on by itself, because the operator who took the
            chat is the only one who knows whether they are finished with it.
          */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={chat.aiAutoReply}
                disabled={busy}
                onChange={(event) => void act(`/auto-reply?enabled=${event.target.checked}`)}
                className="size-4 accent-[var(--color-signal)]"
              />
              AI javob beradi
            </label>

            {/*
              Archive, not delete. Somebody who blocked the bot leaves a thread that will never
              move again — but what they said before that is why they did not buy, and the
              weekly plan reads it. It comes back on its own if they write again.
            */}
            <button
              type="button"
              disabled={busy}
              onClick={() => void archive(!chat.isArchived)}
              className="text-sm font-bold text-ink-muted transition-colors hover:text-ink disabled:opacity-45"
            >
              {chat.isArchived ? 'Arxivdan chiqarish' : 'Arxivlash'}
            </button>
          </div>
        </div>

        {/*
          The agent offers a demo when somebody names a place clearly enough for it to notice.
          This is for every time it does not — the operator is reading the conversation and can
          see what the model missed.
        */}
        <div className="mt-3">
          {demoOpen ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={situation}
                onChange={(event) => setSituation(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void sendDemo()
                  }
                }}
                autoFocus
                placeholder="Qayerda qiynalyapti — masalan: sport zalda murabbiy bilan"
                className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
              <Button size="sm" onClick={() => void sendDemo()} disabled={busy || !situation.trim()}>
                {busy ? 'Tayyorlanmoqda…' : 'Demo yuborish'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDemoOpen(false)} disabled={busy}>
                Bekor
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="text-sm font-bold text-signal-ink"
              >
                {demoSent ? 'Yana demo yuborish' : 'Demo yuborish'}
              </button>

              {/*
                The agent sends this itself when somebody agrees or says the demo was good.
                This is for the conversations it reads differently from the person watching
                them — and it leaves the agent on, because it is a nudge, not a handover.
              */}
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendOffer()}
                className="text-sm font-bold text-signal-ink disabled:opacity-45"
              >
                {offerSent ? 'Yana to\'lov havolasi' : "To'lov havolasi"}
              </button>

            </div>
          )}
        </div>

        {/* The cap is a floor under the measured height, not a replacement for it: if the
            measurement ever fails, the panel is still one screen rather than a page. */}
        <div
          ref={threadRef}
          className="my-4 max-h-[26rem] min-h-0 flex-1 space-y-3 overflow-y-auto lg:max-h-[calc(100vh-22rem)]"
        >
          {messages.length === 0 ? (
            <EmptyNote>Xabar yo'q</EmptyNote>
          ) : (
            messages.map((message) => <Bubble key={message.id} sender={message.sender} text={message.text} at={message.occurredAt} />)
          )}
        </div>

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            rows={2}
            placeholder="Javob yozing — yuborsangiz AI o'chadi"
            className="min-w-0 flex-1 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
          />
          <Button onClick={() => void send()} disabled={busy || !draft.trim()}>
            Yuborish
          </Button>
        </div>
      </Card>

      {user.userId && (
        <div className="min-h-0 xl:overflow-y-auto">
          <UserCard card={user} />
        </div>
      )}
    </div>
  )
}

/**
 * How close this conversation looks to a purchase.
 *
 * A guess, and labelled as one: it is the model's read of what the person has said, floored by
 * what the product already knows about them. Shown as a bar rather than only a number because
 * the useful question is "which of these is closest", and bars answer that at a glance where
 * percentages have to be compared one at a time.
 */
function Readiness({ value, signal }: { value?: number | null; signal?: string | null }) {
  // Nothing has judged it yet, which is not the same as a score of zero and must not look
  // like one — a new conversation would otherwise sort below somebody who has said no.
  if (value === null || value === undefined) {
    return <span className="truncate text-xs text-ink-faint">baholanmagan</span>
  }

  return (
    <span
      // The signal is why the number is what it is. In the list it lives here rather than on
      // its own line: an operator scanning twenty rows is comparing numbers, and reads the
      // reason only for the one they stop at.
      title={signal ?? undefined}
      className="flex min-w-0 flex-1 items-center gap-1.5"
    >
      <span className="h-1 min-w-8 flex-1 overflow-hidden rounded-[var(--radius-control)] bg-ground-sunken">
        <span
          className={cx(
            'block h-full rounded-[var(--radius-control)]',
            // One hue for the scale, and the milestone colour only at the top: a bar that
            // changes colour halfway invites reading the colour instead of the length.
            value >= 80 ? 'bg-milestone' : 'bg-signal',
          )}
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </span>
      <span className="shrink-0 text-xs font-extrabold tabular-nums text-ink">{value}%</span>
    </span>
  )
}

function Bubble({ sender, text, at }: { sender: ChatSender; text: string; at: string }) {
  const fromUs = sender !== 'User'

  return (
    <div className={cx('flex', fromUs ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'max-w-[85%] rounded-[var(--radius-card)] px-4 py-2.5',
          // The agent and a human are both "us" to the customer, and are told apart here
          // because an operator reading back needs to know which one made a promise.
          sender === 'User'
            ? 'bg-ground-sunken text-ink'
            : sender === 'Ai'
              ? 'bg-signal-soft text-ink'
              : 'bg-milestone-soft text-ink',
        )}
      >
        {fromUs && (
          <div className="mb-0.5 text-xs font-bold text-ink-faint">
            {sender === 'Ai' ? 'AI agent' : 'Operator'}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
        <div className="mt-1 text-right text-[11px] text-ink-faint">{formatDateTime(at)}</div>
      </div>
    </div>
  )
}

/** What the agent was told, shown to the operator so both are answering the same person. */
function UserCard({ card }: { card: SalesChat['user'] }) {
  return (
    <Card className="space-y-3">
      <SectionHeading>Foydalanuvchi</SectionHeading>

      <Badge tone={statusTone[card.status]}>{statusLabel[card.status]}</Badge>

      <dl className="space-y-2 text-sm">
        <Line label="Email" value={card.email ?? '—'} />
        <Line label="Ro'yxatdan o'tgan" value={formatDate(card.registeredAt)} />
        <Line label="Oxirgi faollik" value={formatDate(card.lastActiveAt)} />
        <Line label="Tugatilgan mashqlar" value={formatNumber(card.completedLessons)} />
        <Line label="Kurs kuni" value={card.currentDay > 0 ? `${card.currentDay}-kun` : '—'} />
        <Line label="Daraja" value={card.speakingLevel ?? '—'} />
      </dl>

      {card.triggerEvents.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
            Muhim harakatlar
          </div>
          <ul className="space-y-1.5">
            {card.triggerEvents.map((event) => (
              <li key={event.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-ink-muted">{event.label}</span>
                <span className="font-extrabold tabular-nums text-ink">{event.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2 last:border-b-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  )
}

/** Where Telegram is told to deliver, when nothing has said otherwise. */
const DEFAULT_WEBHOOK_URL = 'https://russian.gg/api/telegram/webhook'

/**
 * The one-minute demos the agent has built.
 *
 * Each row carries its link, so an operator can open exactly what the customer was sent —
 * which is the only way to answer "what did the bot actually give them?" without guessing.
 */
function Demos() {
  const { data, error, isLoading } = useAdminQuery<SalesDemo[]>('/api/admin-portal/sales/demos')

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  if (data.length === 0) {
    return (
      <Card>
        <EmptyNote>
          Hali demo tuzilmagan. Mijoz aynan qayerda qiynalayotganini aytganda, agent o'sha holat
          uchun 1 daqiqalik mashq tayyorlab, havolasini yuboradi.
        </EmptyNote>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <SectionHeading>{formatNumber(data.length)} ta demo</SectionHeading>
      {data.map((demo) => (
        <Card key={demo.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-ink">{demo.titleUz}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {demo.displayName} · {demo.situationUz}
              </p>
            </div>
            <Badge tone={demoTone[demo.status] ?? 'neutral'}>{demoLabel[demo.status] ?? demo.status}</Badge>
          </div>

          {/*
            The three moments worth knowing, and each says something different: sent but never
            opened is a message that did not land, opened but never spoken is a page that did
            not convince, and spoken is the only one that was the point.
          */}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-faint">
            <div>
              <dt className="inline font-bold">Yuborilgan: </dt>
              <dd className="inline">{formatDateTime(demo.createdAt)}</dd>
            </div>
            <div>
              <dt className="inline font-bold">Ochilgan: </dt>
              <dd className="inline">{demo.openedAt ? formatDateTime(demo.openedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="inline font-bold">Gaplashgan: </dt>
              <dd className="inline">
                {demo.completedAt ? `${formatNumber(demo.elapsedSeconds)} soniya` : '—'}
              </dd>
            </div>
          </dl>

          <a
            href={demo.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block truncate font-mono text-xs text-signal-ink"
          >
            {demo.url}
          </a>
        </Card>
      ))}
    </div>
  )
}

const demoLabel: Record<string, string> = {
  ready: 'Kutilmoqda',
  spent: 'Ishlatilgan',
  expired: 'Muddati tugagan',
}

const demoTone: Record<string, 'signal' | 'milestone' | 'neutral'> = {
  ready: 'signal',
  spent: 'milestone',
  expired: 'neutral',
}

function AgentSettings() {
  const { data, error, isLoading, refresh } = useAdminQuery<SalesSettings>('/api/admin-portal/sales/settings')
  const [draft, setDraft] = useState<SalesSettings | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    /*
     * The default goes into the state, not only into the input's `value`. It used to be shown
     * as a fallback while the state stayed null, so the field looked filled in and the save
     * sent nothing — the token was stored, the webhook was never registered, and Telegram sat
     * holding messages with nowhere to deliver them.
     */
    if (data) setDraft({ ...data, webhookUrl: data.webhookUrl ?? DEFAULT_WEBHOOK_URL })
  }, [data])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!draft && isLoading) return <Loading />
  if (!draft) return null

  /** Retries the registration on its own, so a failure does not mean pasting the token again. */
  async function connectWebhook() {
    if (!draft) return

    setBusy(true)
    setFailure('')
    try {
      await adminFetch(
        `/api/admin-portal/sales/webhook?url=${encodeURIComponent(draft.webhookUrl ?? DEFAULT_WEBHOOK_URL)}`,
        { method: 'POST' },
      )
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Webhook ulanmadi')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft) return

    setBusy(true)
    setFailure('')
    try {
      await adminFetch('/api/admin-portal/sales/settings', {
        method: 'PUT',
        body: JSON.stringify({
          systemPrompt: draft.systemPrompt,
          isEnabled: draft.isEnabled,
          webhookUrl: draft.webhookUrl,
          siteBaseUrl: draft.siteBaseUrl,
          // Empty means "keep the one you have": the field starts empty every time, because
          // nothing ever sends the stored token back to this screen.
          botToken: token.trim() || null,
        }),
      })
      setToken('')
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Saqlanmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <SectionHeading>Telegram bot</SectionHeading>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={draft.botConfigured ? 'milestone' : 'caution'}>
            {draft.botConfigured ? `Ulangan ${draft.botTokenHint ?? ''}` : 'Token kiritilmagan'}
          </Badge>
          {draft.botUsername && <Badge tone="signal">@{draft.botUsername}</Badge>}
          <Badge tone={draft.webhookRegistered ? 'milestone' : 'caution'}>
            {draft.webhookRegistered ? 'Webhook ulangan' : 'Webhook ulanmagan'}
          </Badge>
          {/*
            What Telegram will actually deliver, not what the code last asked for. A
            registration made before callback_query was added keeps the old list, and the
            symptom is a button that does nothing with no error anywhere — the request never
            happens. Shown so that is a thing somebody can see rather than deduce.
          */}
          {draft.webhookRegistered && !draft.webhookAllowedUpdates?.includes('callback_query') && (
            <Badge tone="caution">Tugmalar yetib kelmaydi — webhookni qayta ulang</Badge>
          )}
          {draft.webhookPendingUpdates > 0 && (
            <Badge tone="caution">{draft.webhookPendingUpdates} ta kutayotgan xabar</Badge>
          )}
        </div>

        {/*
          Telegram's own words for why the last delivery failed. Without this the symptom of a
          wrong secret or a moved URL is silence — messages arriving nowhere, forever.
        */}
        {draft.webhookLastError && (
          <ErrorNote>Telegram: {draft.webhookLastError}</ErrorNote>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">
            Bot tokeni {draft.botConfigured && '(o\'zgartirish uchun yangisini kiriting)'}
          </span>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="@BotFather bergan token"
            autoComplete="off"
            className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Webhook manzili</span>
          <input
            value={draft.webhookUrl ?? DEFAULT_WEBHOOK_URL}
            onChange={(event) => setDraft({ ...draft, webhookUrl: event.target.value })}
            className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 font-mono text-sm text-ink focus:border-signal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Sayt manzili</span>
          <input
            value={draft.siteBaseUrl ?? ''}
            onChange={(event) => setDraft({ ...draft, siteBaseUrl: event.target.value })}
            className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 font-mono text-sm text-ink focus:border-signal focus:outline-none"
          />
          {/* Not the webhook. That one is the API; these two are different hosts here, and a
              demo link built from the wrong one is a dead link sent to somebody interested. */}
          <span className="mt-1.5 block text-xs text-ink-faint">
            Demo havolalari shu manzildan yasaladi — API emas, foydalanuvchi ochadigan sayt.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void connectWebhook()} disabled={busy || !draft.botConfigured}>
            Webhookni ulash
          </Button>
          <span className="text-xs text-ink-faint">
            Token saqlangach webhook o'zi ro'yxatdan o'tadi; bu tugma qayta urinish uchun.
          </span>
        </div>

        <p className="text-xs text-ink-faint">
          Maxfiy kalit avtomatik yaratiladi — uni kiritish shart emas. Token qaytarib
          ko'rsatilmaydi.
        </p>
      </Card>

    <Card className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          checked={draft.isEnabled}
          onChange={(event) => setDraft({ ...draft, isEnabled: event.target.checked })}
          className="size-4 accent-[var(--color-signal)]"
        />
        Agent yoqilgan
      </label>

      {/*
        Said where the switch is: off does not mean deaf. Everything is still recorded, so a
        conversation an operator picks up later is complete.
      */}
      <p className="text-xs text-ink-faint">
        O'chirilganda bot xabarlarni yozib boradi, lekin javob bermaydi.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink">Agent ko'rsatmasi</span>
        {/*
          The stored prompt belongs to the operator, so a better default is worth nothing
          unless they can see it and choose it. Loaded into the editor rather than saved, so
          nothing is replaced until they look at it and press save.
        */}
        <button
          type="button"
          onClick={() => setDraft({ ...draft, systemPrompt: draft.defaultPrompt })}
          className="text-xs font-bold text-signal-ink"
        >
          Standart matnni yuklash
        </button>
      </div>

      {/*
        The stored prompt is the one that runs, and it is the operator's. That is the right
        rule and it has a cost nobody could see: a shipped improvement to the script — the
        agent learning to offer a demo, or to propose a topic when somebody cannot name one —
        sat in the code doing nothing, because production was still running the text saved
        months earlier and no screen said so. Now one does.
      */}
      {data && data.systemPrompt !== data.defaultPrompt && (
        <p className="rounded-[var(--radius-card)] border-2 border-caution/40 bg-caution-soft px-4 py-3 text-sm text-caution">
          Saqlangan ko'rsatma yangilangan standart matndan farq qiladi. Agentga qo'shilgan
          yangi qobiliyatlar ishlashi uchun «Standart matnni yuklash» ni bosib, saqlang —
          o'zingiz kiritgan o'zgarishlar bo'lsa, avval nusxasini olib qo'ying.
        </p>
      )}

      <label className="block">
        <textarea
          value={draft.systemPrompt}
          onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
          rows={20}
          className="w-full rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3 font-mono text-xs leading-relaxed text-ink focus:border-signal focus:outline-none"
        />
      </label>

      <p className="text-xs text-ink-faint">
        {'{{user_name}}, {{user_status}}, {{last_activity}}, {{user_metrics_summary}}'} — bu
        o'rinbosarlar har bir suhbatda haqiqiy ma'lumot bilan almashtiriladi.
      </p>

      {failure && <ErrorNote>{failure}</ErrorNote>}

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saqlanmoqda…' : 'Saqlash'}
        </Button>
        <span className="text-xs text-ink-faint">Yangilangan: {formatDateTime(data?.updatedAt)}</span>
      </div>
      </Card>
    </div>
  )
}
