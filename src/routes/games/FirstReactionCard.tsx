import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, LockKeyhole, Sparkles, Zap } from 'lucide-react'
import * as m from 'motion/react-m'
import { useLocale, useT } from '../../lib/i18n'
import { rise } from '../../lib/motion'
import { gameLabels } from './speaking/copy'

const MotionLink = m.create(Link)
const labels = {
  uz: { badge: 'Birinchi fikringni ayt', seconds: '20 soniya', rounds: '5 ta vaziyat', preview: 'Vaziyatni ko‘r. Ruscha javob ber.', reply: 'Ого! Как здорово!' },
  ru: { badge: 'Реагируй по-русски', seconds: '20 секунд', rounds: '5 ситуаций', preview: 'Посмотри на ситуацию. Скажи, что думаешь.', reply: 'Ого! Как здорово!' },
  en: { badge: 'Say what comes to mind', seconds: '20 seconds', rounds: '5 situations', preview: 'See the situation. React in Russian.', reply: 'Ого! Как здорово!' },
}

export function FirstReactionCard({ to, requiresPro }: { to: string; requiresPro: boolean }) {
  const { locale } = useLocale()
  const copy = labels[locale]
  const arcade = useT().arcade
  return <MotionLink variants={rise} to={to} aria-labelledby="first-reaction-card-title"
    className="group relative isolate overflow-hidden rounded-[32px] border border-violet-300/35 bg-gradient-to-br from-[#29135c] via-[#25276f] to-[#12365d] p-5 text-white shadow-2xl transition-colors hover:border-violet-200/70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal sm:p-7 lg:col-span-2">
    <span className="flex flex-wrap items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/30 bg-violet-300/10 px-3 py-1 text-[11px] font-black tracking-wider text-violet-100 uppercase"><Zap aria-hidden="true" className="size-3.5" />{copy.badge}</span>
      <span className="flex flex-wrap gap-2">
        {requiresPro && <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/30 bg-amber-300/15 px-3 py-1 text-xs font-black text-amber-100"><LockKeyhole aria-hidden="true" className="size-3.5" />{arcade.proRequired}</span>}
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-xs font-black text-cyan-100"><Clock3 aria-hidden="true" className="size-3.5" />{copy.seconds}</span>
      </span>
    </span>
    <span className="mt-4 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
      <span aria-hidden="true" className="relative flex h-56 flex-col items-center justify-end overflow-hidden rounded-2xl border border-white/20 bg-[radial-gradient(ellipse_at_50%_85%,#37c8dc55,transparent_65%),linear-gradient(145deg,#411c76,#20235a_60%,#12425b)] px-3 pb-2">
        <Sparkles className="absolute top-7 left-6 size-8 text-violet-200/40" />
        <Zap className="absolute right-5 bottom-7 size-12 rotate-12 text-amber-200/25" />
        <span className="absolute top-4 rounded-2xl rounded-bl-sm border border-white/35 bg-white/95 px-4 py-2 text-sm font-black text-[#33255d] shadow-xl" lang="ru">{copy.reply}</span>
        <span className="relative grid w-full max-w-80 grid-cols-[1fr_1.2fr_1fr] items-end gap-1">
          {['panda', 'penguin', 'pero'].map((character) => <img key={character} src={`/games/first-reaction/characters/${character}.webp`} alt="" loading="lazy" decoding="async" width="512" height="512"
            className={`${character === 'penguin' ? 'h-36' : 'h-28'} w-full min-w-0 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1`} />)}
        </span>
        <span className="mt-1 flex gap-1.5">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1.5 w-7 rounded-full ${index === 0 ? 'bg-cyan-200' : 'bg-white/20'}`} />)}</span>
      </span>
      <span className="min-w-0">
        <strong id="first-reaction-card-title" className="block text-2xl font-black sm:text-3xl">{gameLabels['first-reaction'][locale].title}</strong>
        <span className="mt-2 block text-sm leading-relaxed text-violet-100/85">{copy.preview}</span>
        <span className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#a971ff] to-[#5b67ed] px-6 py-3 text-sm font-black shadow-lg shadow-violet-500/30 transition-colors group-hover:from-violet-400 group-hover:to-indigo-500">{arcade.play}<ArrowRight aria-hidden="true" className="size-4" /></span>
          <span className="text-xs font-bold text-violet-100/80">{copy.rounds}</span>
        </span>
      </span>
    </span>
  </MotionLink>
}
