import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { adminFetch, formatDate, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import { useStickyTab } from '../lib/sticky-tab'
import type {
  SalesMessage,
  SalesChat,
  SalesDashboard as SalesDashboardData,
  SalesChatPage,
  SalesChatSummary,
  SalesFolder,
  SalesUnread,
  SalesSettings,
  SalesUserStatus,
} from '../lib/types'
import { Badge, Button, Card, ErrorNote, Loading, PageHeader, PeriodToggle, Screen, SectionHeading, Stat, Tabs } from '../components/ui'
import { Checkbox } from '../../src/components/forms/Checkbox'
import { BarList, ColumnChart } from '../components/charts'
import { cx } from '../../src/lib/cx'
import { AiGlyph, ArchiveGlyph, BackGlyph, DashboardGlyph, InboxGlyph, PaymentGlyph, PinGlyph, SlidersGlyph, SoundGlyph } from '../components/icons'
import { playIncomingChime, soundMuted } from '../lib/notify'
import { Avatar, ChatThread, Composer } from '../components/ChatThread'

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

const SALES_TABS = ['dashboard', 'inbox', 'settings'] as const

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

/**
 * The folders as Telegram draws them: a row of words with a line under the open one. The pill
 * switch this replaced did not fit the list column — the last folder was cut in half.
 * The count rides on Yangilar, which is the folder it describes.
 */
function FolderTabs({
  value,
  onChange,
  waiting,
}: {
  value: SalesFolder
  onChange: (folder: SalesFolder) => void
  waiting: number
}) {
  return (
    <div role="tablist" aria-label="Papkalar" className="-mb-[2px] flex">
      {FOLDER_TABS.map((tab) => {
        const active = tab.id === value
        const badge = tab.id === 'New' ? waiting : 0

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cx(
              'flex min-w-0 flex-1 items-center justify-center gap-1 border-b-2 px-1 pt-1 pb-2 text-[13px] font-extrabold transition-colors',
              active ? 'border-signal text-signal-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            <span className="truncate">{tab.label}</span>
            {badge > 0 && (
              <span className="min-w-4 shrink-0 rounded-full bg-signal px-1 text-center text-[10px] leading-4 text-on-signal">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

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

  const sections: Array<{
    id: (typeof SALES_TABS)[number]
    label: string
    Glyph: () => React.ReactElement
    badge?: number
  }> = [
    { id: 'dashboard', label: 'Sotuv paneli', Glyph: DashboardGlyph },
    // Conversations waiting, not messages: five from one person is one thing to answer.
    { id: 'inbox', label: 'Suhbatlar', Glyph: InboxGlyph, badge: unread?.chats },
    { id: 'settings', label: 'Agent sozlamalari', Glyph: SlidersGlyph },
  ]

  return (
    /*
      Padded on the right from `lg` to leave the rail its column. The rail floats over the
      page, so without this the conversation would run underneath it.
    */
    <Screen className="space-y-4 lg:pr-16">
      <PageHeader title="Sotuv (Telegram)" subtitle="Bot yuritayotgan suhbatlar va sotuv agenti" />

      {/*
        A row on a phone, a rail on the right from `lg`.

        These four were a strip across the top, and on a laptop they cost the inbox a row it
        could not spare — the list was down to three conversations. Height is what this screen
        is short of and width is what it has, so the switch moved to the side.
      */}
      <div className="lg:hidden">
        <Tabs
          value={tab}
          onChange={setTab}
          options={sections.map(({ id, label, badge }) => ({ id, label, badge }))}
        />
      </div>

      <nav
        aria-label="Sotuv bo'limlari"
        className="fixed top-1/2 right-3 z-30 hidden -translate-y-1/2 flex-col gap-1 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-1.5 shadow-lg lg:flex"
      >
        {sections.map(({ id, label, Glyph, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            title={label}
            aria-label={label}
            aria-current={tab === id ? 'page' : undefined}
            className={cx(
              'relative grid size-10 place-items-center rounded-[var(--radius-control)] transition-colors',
              tab === id
                ? 'bg-signal text-on-signal'
                : 'text-ink-muted hover:bg-ground-sunken hover:text-ink',
            )}
          >
            <Glyph />
            {/* The badge follows the inbox onto the rail: it is the reason to look at all. */}
            {badge ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-danger px-1 py-px text-center text-[10px] leading-tight font-extrabold text-on-danger">
                {badge > 99 ? '99+' : badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && <SalesDashboardTab />}
      {tab === 'inbox' && <Inbox waiting={unread?.chats ?? 0} />}
      {tab === 'settings' && <AgentSettings />}
    </Screen>
  )
}

function SalesDashboardTab() {
  const [days, setDays] = useState(30)
  const { data, error, isLoading, refresh } = useAdminQuery<SalesDashboardData>(
    `/api/admin-portal/sales/dashboard?days=${days}`,
  )

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const period = `${days} kunlik davr`
  const answered = data.averageReplySeconds

  return (
    <Screen className="space-y-6">
      <div className="flex justify-end">
        <PeriodToggle value={days} onChange={setDays} />
      </div>

      <section>
        <SectionHeading>Suhbatlar</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    </Screen>
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
  const [selected, setSelected] = useState<string | null>(null)

  /*
   * The open chat is sent along so the server keeps it in Yangilar. Opening a chat is what
   * marks it read, and without this the row left the list on the next poll — it vanished from
   * under the operator still reading it, and when it was the only new chat the whole inbox went
   * with it. A messenger's unread filter holds on to the chat you are in the same way.
   */
  const { data, error, isLoading, refresh } = useAdminQuery<SalesChatPage | SalesChatSummary[]>(
    `/api/admin-portal/sales/chats?take=${take}&folder=${folder}${selected ? `&keep=${selected}` : ''}`,
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
  const [muted, setMuted] = useState(soundMuted.get)
  const { shell, height } = useViewportHeight()

  /*
   * Refreshed rather than patched locally: the pin decides the order, and the order is the
   * server's. Reordering here from a guess and then being corrected by the next poll is a
   * list that jumps twice.
   */
  async function pin(chatId: string, pinned: boolean) {
    await adminFetch(`/api/admin-portal/sales/chats/${chatId}/pin?pinned=${pinned}`, {
      method: 'POST',
    })
    refresh()
  }

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
   * Only on a wide screen. On a phone the list and the chat take turns, as in Telegram, and a
   * chat that opened by itself would hide the list the operator came to read.
   */
  useEffect(() => {
    if (selected !== null || chats.length === 0) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    setSelected(chats[0].id)
  }, [chats, selected])

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  return (
    /*
      One panel, list and conversation side by side with a rule between them, as Telegram
      Desktop draws it. Two separate cards with a gap read as two screens.
    */
    <div
      ref={shell}
      style={height ? { height } : undefined}
      className="grid min-h-0 grid-cols-1 overflow-hidden rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]"
    >
      <aside className={cx('flex min-h-0 flex-col lg:border-r-2 lg:border-hairline', selected && 'max-lg:hidden')}>
        {/*
          The folders and the count stay put above the list. They are how you change what the
          list shows, and scrolling back up to reach them is the one thing a switch must never ask.
        */}
        <div className="border-b-2 border-hairline px-3 pt-2">
          <div className="flex items-center justify-between gap-2 px-1 pb-1.5 text-xs">
            <span className="font-bold text-ink-faint">
              {formatNumber(chats.length)} / {formatNumber(total)}
            </span>
            {/*
              The icon is the state. It replaced the words "Ovoz yoqilgan", which said the same
              thing across half a column the list needs for names.
            */}
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
              title={muted ? "Ovoz o'chirilgan — yoqish" : "Ovoz yoqilgan — o'chirish"}
              aria-label={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
              aria-pressed={!muted}
              className={cx(
                'grid size-6 place-items-center rounded-full transition-colors',
                muted ? 'text-ink-faint hover:text-ink' : 'text-signal-ink hover:bg-ground-sunken',
              )}
            >
              <SoundGlyph on={!muted} />
            </button>
          </div>
          <FolderTabs value={folder} onChange={setFolder} waiting={waiting} />
        </div>

        {/*
          Its own scroll, so reading down the list leaves the open conversation exactly where it
          was — which is how every messenger behaves.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1 [scrollbar-width:thin] max-lg:max-h-[75vh]">
          {chats.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-ink-faint">{EMPTY[folder]}</p>
          )}

          {chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={selected === chat.id}
              onOpen={() => setSelected(chat.id)}
              onPin={() => void pin(chat.id, !chat.isPinned)}
            />
          ))}

          {chats.length < total && (
            <button
              type="button"
              onClick={() => setTake((current) => current + PAGE)}
              className="mx-3 my-2 w-[calc(100%-1.5rem)] rounded-full py-2 text-sm font-bold text-signal-ink transition-colors hover:bg-ground-sunken"
            >
              Yana {formatNumber(Math.min(PAGE, total - chats.length))} ta
            </button>
          )}
        </div>
      </aside>

      {/* Keyed by chat, so a draft, a reply in progress or a picked file never follows the
          operator into somebody else's conversation. */}
      {selected ? (
        <Conversation key={selected} chatId={selected} onChanged={refresh} onBack={() => setSelected(null)} />
      ) : (
        <div className="hidden place-items-center bg-ground-sunken lg:grid">
          <span className="rounded-full bg-ground-raised/80 px-4 py-1.5 text-sm font-bold text-ink-muted">
            Suhbatni tanlang
          </span>
        </div>
      )}
    </div>
  )
}

/** Uzbek short weekday names, Sunday first, as `Date.getDay` counts. */
const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']

/** The time beside a chat: the hour today, the weekday this week, the date before that — Telegram's rule. */
function listTime(value: string) {
  const date = new Date(value)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  const days = (now.getTime() - date.getTime()) / 86_400_000
  if (days < 6) return WEEKDAYS[date.getDay()]

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * One conversation in the list, the way Telegram draws one: avatar, name and time, the last
 * line with its unread count, and — the part Telegram does not have — where this person stands
 * and how close they look to buying, small enough not to cost a row its height.
 */
function ChatRow({
  chat,
  active,
  onOpen,
  onPin,
}: {
  chat: SalesChatSummary
  active: boolean
  onOpen: () => void
  onPin: () => void
}) {
  const quiet = 'text-ink-faint'

  return (
    /*
      A div rather than a button, because the pin inside it is a button and one cannot live
      inside the other. The role and the key handler put back what was lost.
    */
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'group relative mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors',
        active
          ? 'bg-signal-soft before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-signal'
          : 'hover:bg-ground-sunken',
      )}
    >
      <Avatar name={chat.displayName} seed={chat.chatId} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cx('truncate text-[15px]', chat.unread > 0 ? 'font-black' : 'font-extrabold')}>
            {chat.displayName}
          </span>
          {chat.isPinned && (
            <span className={cx('shrink-0', quiet)} title="Tepada ushlab turilgan">
              <PinGlyph filled />
            </span>
          )}
          <span className={cx('ml-auto shrink-0 text-xs', quiet)}>{listTime(chat.lastInteractionAt)}</span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
            {/* Telegram's "You:" — our side of the conversation said the last thing. */}
            {!chat.lastMessageFromUser && chat.lastMessage && (
              <span className="font-bold text-signal-ink">Siz: </span>
            )}
            {chat.lastMessage ?? '—'}
          </p>

          {/*
            Visible when pinned or under the pointer, always in the layout: appearing on hover
            alone would shift the row every time the mouse crossed it.
          */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onPin()
            }}
            title={chat.isPinned ? 'Tepadan olib tashlash' : 'Tepada ushlab turish'}
            aria-label={chat.isPinned ? 'Tepadan olib tashlash' : 'Tepada ushlab turish'}
            aria-pressed={chat.isPinned ?? false}
            className={cx(
              'grid size-5 shrink-0 place-items-center rounded transition-opacity',
              quiet,
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            )}
          >
            <PinGlyph filled={chat.isPinned ?? false} />
          </button>

          {chat.unread > 0 && (
            <span
              aria-label={`${chat.unread} ta o'qilmagan xabar`}
              className={cx(
                'min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none font-extrabold',
                'bg-signal text-on-signal',
              )}
            >
              {chat.unread > 99 ? '99+' : chat.unread}
            </span>
          )}
        </div>

        <div className={cx('mt-1 flex items-center gap-1.5 text-[11px] font-bold', quiet)}>
          <span className="truncate">{statusLabel[chat.status]}</span>
          {!chat.aiAutoReply && (
            <span
              title="AI o'chiq — operator javob beradi"
              className={cx(
                'shrink-0 rounded-full px-1.5 py-px',
                'bg-caution-soft text-caution',
              )}
            >
              Qo'lda
            </span>
          )}
          <ReadinessTag value={chat.readiness} signal={chat.readinessSignal} />
        </div>
      </div>
    </div>
  )
}

/**
 * How close this conversation looks to a purchase.
 *
 * A guess, and labelled as one: it is the model's read of what the person has said, floored by
 * what the product already knows about them. Kept to a short bar and a number so twenty rows
 * can be compared at a glance; the reason is in the tooltip, for the one an operator stops at.
 */
function ReadinessTag({ value, signal }: { value?: number | null; signal?: string | null }) {
  // Nothing has judged it yet, which is not the same as zero and must not look like it.
  if (value === null || value === undefined) return null

  return (
    <span title={signal ?? undefined} className="ml-auto flex shrink-0 items-center gap-1">
      <span className="h-1 w-8 overflow-hidden rounded-full bg-ink-faint/20">
        <span
          className={cx(
            'block h-full rounded-full',
            value >= 80 ? 'bg-milestone' : 'bg-signal',
          )}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </span>
      <span className="tabular-nums">{value}%</span>
    </span>
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

function Conversation({
  chatId,
  onChanged,
  onBack,
}: {
  chatId: string
  onChanged: () => void
  /** Back to the list, on a screen too narrow to show both. */
  onBack: () => void
}) {
  const { data, error, isLoading, refresh } = useAdminQuery<SalesChat>(
    `/api/admin-portal/sales/chats/${chatId}`,
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [replyTo, setReplyTo] = useState<SalesMessage | null>(null)
  const [showCard, setShowCard] = useState(true)

  useEffect(() => {
    const timer = window.setInterval(refresh, 4000)

    return () => window.clearInterval(timer)
  }, [refresh])

  if (error) {
    return (
      <div className="p-4">
        <ErrorNote onRetry={refresh}>{error}</ErrorNote>
      </div>
    )
  }
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const { chat, user, messages } = data

  /** Runs one action, and says whether it worked so the composer knows to clear itself. */
  async function act(path: string, body?: unknown | FormData) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/sales/chats/${chatId}${path}`, {
        method: 'POST',
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      })
      refresh()
      onChanged()
      return true
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function sendText(text: string) {
    const sent = await act('/messages', { text, replyToMessageId: replyTo?.id ?? null })
    if (sent) setReplyTo(null)
    return sent
  }

  async function sendFile(file: File, caption: string) {
    const form = new FormData()
    form.append('file', file)
    if (caption) form.append('caption', caption)
    if (replyTo) form.append('replyToMessageId', replyTo.id)

    const sent = await act('/media', form)
    if (sent) setReplyTo(null)
    return sent
  }

  // Fire and forget: an indicator that did not arrive is not worth an error on screen.
  function typing() {
    void adminFetch(`/api/admin-portal/sales/chats/${chatId}/typing`, { method: 'POST' }).catch(() => undefined)
  }

  /*
   * Archive, not delete. Somebody who blocked the bot leaves a thread that will never move
   * again — but what they said before that is why they did not buy, and the weekly plan reads
   * it. It comes back on its own if they write again.
   */
  const archive = () => act(`/archive?archived=${!chat.isArchived}`)

  /*
   * The agent sends the payment page itself when somebody agrees. This is for the
   * conversations it reads differently from the person watching them — and it leaves the
   * agent on, because it is a nudge, not a handover.
   */
  const sendOffer = () => act('/offer')

  const linked = Boolean(user.userId)

  return (
    <div
      className={cx(
        'grid min-h-0 grid-cols-1',
        // The card is a column of facts about an account. With no account there are no facts,
        // and a panel that exists only to say so is width the conversation should have had.
        linked && showCard && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]',
      )}
    >
      <section className="flex min-h-0 flex-col">
        {/* Telegram's chat header: who, where they stand, and the few things you do to a chat. */}
        <header className="flex items-center gap-3 border-b-2 border-hairline px-3 py-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Suhbatlar ro'yxatiga"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-ground-sunken lg:hidden"
          >
            <BackGlyph />
          </button>

          <button
            type="button"
            onClick={() => setShowCard((current) => !current)}
            disabled={!linked}
            title={linked ? 'Foydalanuvchi kartasi' : undefined}
            className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
          >
            <Avatar name={chat.displayName} seed={chat.chatId} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold text-ink">{chat.displayName}</span>
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-faint">
                <span className="truncate">{chat.username ? `@${chat.username}` : `#${chat.chatId}`}</span>
                <span aria-hidden="true" className="max-sm:hidden">·</span>
                {/* Kept in the header, because "have they signed up" is the one thing about
                    them that changes how this conversation should go. */}
                <span className="truncate max-sm:hidden">{statusLabel[user.status]}</span>
                {chat.readiness != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span title={chat.readinessSignal ?? undefined} className="shrink-0 font-bold text-signal-ink">
                      {chat.readiness}% tayyor
                    </span>
                  </>
                )}
              </span>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            {chat.username && (
              <a
                href={`https://t.me/${chat.username}`}
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-full px-3 py-1.5 text-xs font-bold text-signal-ink hover:bg-ground-sunken md:block"
              >
                Telegramda ochish
              </a>
            )}

            {/*
              The one control that decides who is answering. Turning it back on after a
              handover is deliberate — nothing turns it on by itself, because the operator who
              took the chat is the only one who knows whether they are finished with it.
            */}
            <button
              type="button"
              onClick={() => void act(`/auto-reply?enabled=${!chat.aiAutoReply}`)}
              disabled={busy}
              aria-pressed={chat.aiAutoReply}
              aria-label={chat.aiAutoReply ? "AI javob beradi" : "AI o'chiq"}
              title={chat.aiAutoReply ? "AI javob beryapti — o'chirish" : 'AI o\'chiq — yoqish'}
              className={cx(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors disabled:opacity-45',
                chat.aiAutoReply
                  ? 'bg-signal-soft text-signal-ink hover:bg-signal-soft/70'
                  : 'bg-ground-sunken text-ink-muted hover:text-ink',
              )}
            >
              <AiGlyph />
              <span className="max-sm:hidden">{chat.aiAutoReply ? 'AI yoqiq' : "AI o'chiq"}</span>
            </button>

            <HeaderAction title="To'lov havolasini yuborish" onClick={() => void sendOffer()} disabled={busy}>
              <PaymentGlyph />
            </HeaderAction>
            <HeaderAction
              title={chat.isArchived ? 'Arxivdan chiqarish' : 'Arxivlash'}
              onClick={() => void archive()}
              disabled={busy}
            >
              <ArchiveGlyph restore={chat.isArchived ?? false} />
            </HeaderAction>
          </div>
        </header>

        <ChatThread
          messages={messages}
          previousReadAt={data.previousReadAt}
          onReply={setReplyTo}
          className="min-h-0 flex-1 max-lg:h-[62vh]"
        />

        {failure && (
          <div className="border-t-2 border-hairline px-3 py-2">
            <ErrorNote>{failure}</ErrorNote>
          </div>
        )}

        <Composer
          busy={busy}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSendText={sendText}
          onSendFile={sendFile}
          onTyping={typing}
          placeholder={chat.aiAutoReply ? "Xabar yozing — yuborsangiz AI o'chadi" : 'Xabar yozing'}
        />
      </section>

      {linked && showCard && (
        <div className="hidden min-h-0 overflow-y-auto border-l-2 border-hairline p-3 [scrollbar-width:thin] xl:block">
          <UserCard card={user} />
        </div>
      )}
    </div>
  )
}

function HeaderAction({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ground-sunken hover:text-ink disabled:opacity-45"
    >
      {children}
    </button>
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
      <dd className="min-w-0 text-right font-bold text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

/** Where Telegram is told to deliver, when nothing has said otherwise. */
const DEFAULT_WEBHOOK_URL = 'https://russian.gg/api/telegram/webhook'

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

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
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
    <Screen className="space-y-4">
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
      <Checkbox
        checked={draft.isEnabled}
        onChange={(checked) => setDraft({ ...draft, isEnabled: checked })}
        className="text-sm font-bold text-ink"
      >
        Agent yoqilgan
      </Checkbox>

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
    </Screen>
  )
}
