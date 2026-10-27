import { Check, LockKeyhole, Play, Search, SpellCheck } from 'lucide-react'
import * as m from 'motion/react-m'
import { Link } from 'react-router-dom'
import { useLocale, useT } from '../../lib/i18n'
import { rise } from '../../lib/motion'
import { copies, gameLabels } from './speaking/copy'

const MotionLink = m.create(Link)
const badges = {
  uz: { hunt: 'Xatoni toping', skill: 'Grammatika' },
  ru: { hunt: 'Найдите ошибку', skill: 'Грамматика' },
  en: { hunt: 'Spot the mistake', skill: 'Grammar' },
}

export function ErrorHuntCard({ to, requiresPro }: { to: string; requiresPro: boolean }) {
  const { locale } = useLocale()
  const copy = copies[locale]
  const label = gameLabels['error-hunt'][locale]
  const { play, proRequired, unlockWithPro } = useT().arcade

  return (
    <MotionLink
      variants={rise}
      to={to}
      aria-labelledby="error-hunt-card-title"
      className="group relative isolate overflow-hidden rounded-[32px] border border-violet-300/30 bg-gradient-to-br from-[#1A0B2E] via-[#2D1B4E] to-[#211238] p-5 text-white shadow-2xl transition-colors duration-300 hover:border-violet-200/70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal sm:p-7 lg:col-span-2"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 -z-10 size-96 rounded-full bg-violet-400/20 blur-3xl" />
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-200/10 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-100 uppercase">
          <Search aria-hidden="true" className="size-3.5" /> {badges[locale].hunt}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-2">
          {requiresPro && <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/30 bg-amber-300/15 px-3 py-1 text-xs font-black text-amber-100"><LockKeyhole aria-hidden="true" className="size-3.5" />{proRequired}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200/25 bg-violet-200/10 px-3 py-1 text-xs font-black text-violet-100">
            <SpellCheck aria-hidden="true" className="size-4" /> {badges[locale].skill}
          </span>
        </span>
      </span>

      <span className="mt-4 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <span aria-hidden="true" className="relative flex h-64 flex-col items-center justify-end overflow-hidden rounded-2xl border border-violet-200/25 bg-gradient-to-b from-[#201034] via-[#3b205b] to-[#24123d] px-2 pb-3">
          <span className="pointer-events-none absolute inset-0 opacity-10 [background-image:linear-gradient(#c4b5fd_1px,transparent_1px),linear-gradient(90deg,#c4b5fd_1px,transparent_1px)] [background-size:28px_28px]" />
          <span lang="ru" className="absolute top-4 flex -rotate-2 items-center gap-3 rounded-2xl border border-[#FF4081]/60 bg-[#301c48]/90 px-4 py-2.5 shadow-[0_0_24px_#ff40811a] backdrop-blur-md">
            <span className="grid gap-1 text-center text-base font-black text-white">
              <span><span className="text-[#ff80ab] line-through decoration-2">Моё</span> мама.</span>
              <span><span className="rounded-md bg-[#00E676]/15 px-1 text-[#69ffb6]">Моя</span> мама.</span>
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-[#00E676] text-[#062919]"><Check className="size-5" strokeWidth={3} /></span>
          </span>
          <span className="absolute -bottom-16 h-36 w-80 rounded-[50%] border border-violet-300/20 bg-violet-300/5 shadow-[0_0_30px_#a78bfa20]" />
          <span className="relative grid w-full max-w-80 grid-cols-[1fr_1.15fr_1fr] items-end gap-1">
            <img src="/games/error-hunt/characters/panda.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-32 w-full -rotate-3 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
            <img src="/games/error-hunt/characters/penguin.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-36 w-full object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-2" />
            <img src="/games/error-hunt/characters/pero.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-32 w-full rotate-3 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
          </span>
        </span>

        <span className="min-w-0">
          <strong id="error-hunt-card-title" className="block text-2xl font-black sm:text-3xl">{label.title}</strong>
          <span className="mt-2 block text-sm leading-relaxed text-violet-100/80">{label.description}</span>
          <span className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#00E676] px-6 py-3 text-sm font-black text-[#062919] shadow-[0_0_24px_#00e67620] transition-colors group-hover:bg-[#69ffb6]">
              {requiresPro ? <LockKeyhole aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />} {requiresPro ? unlockWithPro : play}
            </span>
            <span className="text-xs font-bold text-violet-100/80">{copy.rounds}: 5</span>
          </span>
        </span>
      </span>
    </MotionLink>
  )
}
