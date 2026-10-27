import { Link } from 'react-router-dom'
import { ArrowRight, AudioLines, LockKeyhole } from 'lucide-react'
import * as m from 'motion/react-m'
import { useLocale, useT } from '../../../lib/i18n'
import { rise } from '../../../lib/motion'
import { lifeCopies } from './copy'

const MotionLink = m.create(Link)

export function LifeCard({ to, requiresPro }: { to: string; requiresPro: boolean }) {
  const { locale } = useLocale()
  const copy = lifeCopies[locale]
  const { proRequired, unlockWithPro } = useT().arcade
  return (
    <MotionLink
      variants={rise}
      to={to}
      aria-labelledby="life-card-title"
      className="life-card group relative isolate overflow-hidden rounded-[32px] border border-white/30 bg-[linear-gradient(105deg,#b84c7d_0%,#00a9c1_50%,#ba862b_100%)] p-5 text-white shadow-2xl transition-colors duration-300 hover:border-white/70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal sm:p-7 lg:col-span-2"
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-black tracking-wider text-cyan-100 uppercase">
          <AudioLines aria-hidden="true" className="size-3.5 shrink-0" /> {copy.tag}
        </span>
        {requiresPro && <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/30 bg-amber-300/15 px-3 py-1 text-xs font-black text-amber-100"><LockKeyhole aria-hidden="true" className="size-3.5" />{proRequired}</span>}
      </span>

      <span className="mt-4 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <span aria-hidden="true" className="relative grid h-56 grid-cols-3 items-center gap-1 overflow-hidden rounded-2xl border border-white/30 bg-[radial-gradient(ellipse_at_15%_60%,#ffd6e3,transparent_55%),radial-gradient(ellipse_at_50%_60%,#a3fff3,transparent_55%),radial-gradient(ellipse_at_85%_60%,#ffe3a1,transparent_55%)] px-2">
          {['panda', 'penguin', 'pero'].map(character => <img key={character} src={`/games/fight-for-life/characters/${character}.webp`} alt="" loading="lazy" decoding="async" width="512" height="512" className="h-52 w-full min-w-0 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />)}
        </span>

        <span className="min-w-0">
          <strong id="life-card-title" lang="ru" className="block text-2xl font-black sm:text-3xl">Помоги!</strong>
          <span className="mt-2 block text-sm leading-relaxed text-slate-200/90">{copy.intro}</span>
          <span className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-400 to-orange-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/20 transition-colors group-hover:from-orange-300 group-hover:to-orange-500">
            {requiresPro ? unlockWithPro : copy.start}<ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </span>
        </span>
      </span>
    </MotionLink>
  )
}
