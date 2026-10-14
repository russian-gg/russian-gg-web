import { Check, Play, Search, SpellCheck } from 'lucide-react'
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

export function ErrorHuntCard() {
  const { locale } = useLocale()
  const copy = copies[locale]
  const label = gameLabels['error-hunt'][locale]
  const { play } = useT().arcade

  return (
    <MotionLink
      variants={rise}
      to="/games/error-hunt"
      aria-labelledby="error-hunt-card-title"
      className="group relative isolate overflow-hidden rounded-[32px] border border-emerald-300/30 bg-gradient-to-br from-[#092e28] via-[#185547] to-[#123c35] p-5 text-white shadow-2xl transition-colors duration-300 hover:border-emerald-200/70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal sm:p-7 lg:col-span-2"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 -z-10 size-96 rounded-full bg-lime-200/10 blur-3xl" />
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-200/10 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-100 uppercase">
          <Search aria-hidden="true" className="size-3.5" /> {badges[locale].hunt}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-lime-200/25 bg-lime-200/10 px-3 py-1 text-xs font-black text-lime-100">
          <SpellCheck aria-hidden="true" className="size-4" /> {badges[locale].skill}
        </span>
      </span>

      <span className="mt-4 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <span aria-hidden="true" className="relative flex h-64 flex-col items-center justify-end overflow-hidden rounded-2xl border border-emerald-100/30 bg-gradient-to-b from-[#376e5c] via-[#95ba9b] to-[#dfebcb] px-2 pb-3">
          <span className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(#f8ffe8_1px,transparent_1px),linear-gradient(90deg,#f8ffe8_1px,transparent_1px)] [background-size:28px_28px]" />
          <span lang="ru" className="absolute top-4 flex -rotate-2 items-center gap-3 rounded-2xl border-2 border-[#d2bd81] bg-[#fffbed] px-4 py-2.5 shadow-lg">
            <span className="grid gap-1 text-center text-base font-black text-[#194737]">
              <span><span className="text-rose-700 line-through decoration-2">Моё</span> мама.</span>
              <span><span className="rounded-md bg-emerald-100 px-1 text-emerald-800">Моя</span> мама.</span>
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-emerald-700 text-white"><Check className="size-5" strokeWidth={3} /></span>
          </span>
          <span className="absolute -bottom-16 h-36 w-80 rounded-[50%] border border-white/30 bg-white/20" />
          <span className="relative grid w-full max-w-80 grid-cols-[1fr_1.15fr_1fr] items-end gap-1">
            <img src="/games/error-hunt/characters/panda.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-32 w-full -rotate-3 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
            <img src="/games/error-hunt/characters/penguin.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-36 w-full object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-2" />
            <img src="/games/error-hunt/characters/pero.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-32 w-full rotate-3 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
          </span>
        </span>

        <span className="min-w-0">
          <strong id="error-hunt-card-title" className="block text-2xl font-black sm:text-3xl">{label.title}</strong>
          <span className="mt-2 block text-sm leading-relaxed text-emerald-50/90">{label.description}</span>
          <span className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-lime-200 to-emerald-200 px-6 py-3 text-sm font-black text-[#173e2e] shadow-lg shadow-emerald-950/20 transition-colors group-hover:from-lime-100 group-hover:to-emerald-100">
              <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} /> {play}
            </span>
            <span className="text-xs font-bold text-emerald-100/80">{copy.rounds}: 5</span>
          </span>
        </span>
      </span>
    </MotionLink>
  )
}
