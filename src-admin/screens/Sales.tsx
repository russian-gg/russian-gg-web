import { useEffect, useRef, useState } from 'react'
import { adminFetch, formatDate, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import type {
  ChatSender,
  SalesChat,
  SalesChatSummary,
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
  SectionHeading,
  Tabs,
} from '../components/ui'
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

export function Sales() {
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox')

  return (
    <div className="space-y-6">
      <PageHeader title="Sotuv (Telegram)" subtitle="Bot yuritayotgan suhbatlar va sotuv agenti" />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'inbox', label: 'Suhbatlar' },
          { id: 'settings', label: 'Agent sozlamalari' },
        ]}
      />

      {tab === 'inbox' ? <Inbox /> : <AgentSettings />}
    </div>
  )
}

function Inbox() {
  const { data, error, isLoading, refresh } = useAdminQuery<SalesChatSummary[]>(
    '/api/admin-portal/sales/chats',
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [muted, setMuted] = useState(soundMuted.get)

  /*
   * The last thing each chat said, from the previous poll. Held in a ref rather than state so
   * comparing against it does not itself cause a render — and seeded on the first load, so
   * opening the panel does not chime once for every conversation already in it.
   */
  const heard = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    if (!data) return

    const current = new Map(data.map((chat) => [chat.id, chat.lastInteractionAt]))

    if (heard.current === null) {
      heard.current = current

      return
    }

    // One sound however many chats moved at once: five customers writing together is still
    // one thing to look up for.
    const somebodyWrote = data.some(
      (chat) => chat.lastMessageFromUser && heard.current?.get(chat.id) !== chat.lastInteractionAt,
    )

    heard.current = current

    if (somebodyWrote) playIncomingChime()
  }, [data])

  // A sales inbox that only updates when you press something is one nobody watches. Five
  // seconds is faster than a customer notices a delay and slower than it costs anything.
  useEffect(() => {
    const timer = window.setInterval(refresh, 5000)

    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (data && data.length > 0 && selected === null) setSelected(data[0].id)
  }, [data, selected])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  if (data.length === 0) {
    return (
      <Card>
        <EmptyNote>
          Hali suhbat yo'q. Bot sozlangach, unga yozilgan birinchi xabar shu yerda paydo bo'ladi.
        </EmptyNote>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <SectionHeading
          action={
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
              className="text-xs font-bold text-signal-ink"
            >
              {muted ? "Ovoz o'chirilgan" : 'Ovoz yoqilgan'}
            </button>
          }
        >
          {formatNumber(data.length)} ta suhbat
        </SectionHeading>
        {data.map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => setSelected(chat.id)}
            className={cx(
              'block w-full rounded-[var(--radius-card)] border-2 p-4 text-left transition-colors',
              selected === chat.id
                ? 'border-signal bg-signal-soft/40'
                : 'border-hairline bg-ground-raised hover:border-ink-faint',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-extrabold text-ink">{chat.displayName}</span>
              {!chat.aiAutoReply && <Badge>Qo'lda</Badge>}
            </div>

            <p className="mt-1 truncate text-sm text-ink-muted">
              {chat.lastMessageFromUser ? '' : '↩ '}
              {chat.lastMessage ?? '—'}
            </p>

            <div className="mt-2 flex items-center justify-between gap-2">
              <Badge tone={statusTone[chat.status]}>{statusLabel[chat.status]}</Badge>
              <span className="text-xs text-ink-faint">{formatDateTime(chat.lastInteractionAt)}</span>
            </div>

            <Readiness value={chat.readiness} signal={chat.readinessSignal} />
          </button>
        ))}
      </div>

      {selected && <Conversation chatId={selected} onChanged={refresh} />}
    </div>
  )
}

function Conversation({ chatId, onChanged }: { chatId: string; onChanged: () => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<SalesChat>(
    `/api/admin-portal/sales/chats/${chatId}`,
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <Card className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-hairline pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-ink">{chat.displayName}</h2>
            <p className="text-xs text-ink-faint">
              {chat.username ? `@${chat.username}` : `#${chat.chatId}`}
            </p>
          </div>

          {/*
            The one control that decides who is answering. Turning it back on after a handover
            is deliberate — nothing turns it on by itself, because the operator who took the
            chat is the only one who knows whether they are finished with it.
          */}
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
        </div>

        <div ref={threadRef} className="my-4 max-h-[26rem] min-h-0 flex-1 space-y-3 overflow-y-auto">
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

      <UserCard card={user} />
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
    return <p className="mt-2 text-xs text-ink-faint">Sotib olishga yaqinlik: hali baholanmagan</p>
  }

  return (
    <div className="mt-2" title={signal ?? undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-faint">Sotib olishga yaqinlik</span>
        <span className="text-xs font-extrabold tabular-nums text-ink">{value}%</span>
      </div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-[var(--radius-control)] bg-ground-sunken">
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
      {signal && <p className="mt-1 truncate text-xs text-ink-faint">{signal}</p>}
    </div>
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

      {card.userId ? (
        <dl className="space-y-2 text-sm">
          <Line label="Email" value={card.email ?? '—'} />
          <Line label="Ro'yxatdan o'tgan" value={formatDate(card.registeredAt)} />
          <Line label="Oxirgi faollik" value={formatDate(card.lastActiveAt)} />
          <Line label="Tugatilgan mashqlar" value={formatNumber(card.completedLessons)} />
          <Line label="Kurs kuni" value={card.currentDay > 0 ? `${card.currentDay}-kun` : '—'} />
          <Line label="Daraja" value={card.speakingLevel ?? '—'} />
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">
          Bu suhbat hech qanday hisobga bog'lanmagan — platformada ro'yxatdan o'tmagan.
        </p>
      )}

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
