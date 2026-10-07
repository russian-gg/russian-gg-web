import { AudioLines, Clock3, Play } from 'lucide-react'
import * as m from 'motion/react-m'
import { Link } from 'react-router-dom'
import { useLocale, useT } from '../../lib/i18n'
import { rise } from '../../lib/motion'
import { copies, gameLabels } from './speaking/copy'

const MotionLink = m.create(Link)
const badges = { uz: 'Ovozli o‘yin', ru: 'Голосовая игра', en: 'Voice challenge' }

export function TezGapirCard() {
  const { locale } = useLocale()
  const copy = copies[locale]
  const label = gameLabels['tez-gapir'][locale]
  const { play } = useT().arcade

  return (
    <MotionLink
      variants={rise}
      to="/games/tez-gapir"
      aria-labelledby="tez-gapir-card-title"
      className="group relative isolate overflow-hidden rounded-[32px] border border-teal-300/30 bg-gradient-to-br from-[#082d42] via-[#0a4856] to-[#10334e] p-5 text-white shadow-2xl transition-colors duration-300 hover:border-teal-200/70 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-signal sm:p-7 lg:col-span-2"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-teal-300/10 blur-3xl" />
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/25 bg-teal-300/10 px-3 py-1 text-[11px] font-black tracking-wider text-teal-100 uppercase">
          <AudioLines aria-hidden="true" className="size-3.5" /> {badges[locale]}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-black text-amber-200">
          <Clock3 aria-hidden="true" className="size-3.5" /> 30 {copy.seconds}
        </span>
      </span>

      <span className="mt-4 grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <span aria-hidden="true" className="relative flex h-56 flex-col items-center justify-end overflow-hidden rounded-2xl border border-teal-100/30 bg-gradient-to-b from-[#093d58] via-[#087d8a] to-[#94ddcf] px-3 pb-4">
          <span className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(#d8fff5_1px,transparent_1px)] [background-size:18px_18px]" />
          <span className="absolute -bottom-24 size-80 rounded-full border border-white/20 bg-white/10" />
          <span className="absolute -bottom-16 h-44 w-64 rounded-[50%] border border-white/20 bg-teal-50/15" />
          <span lang="ru" className="absolute top-4 rounded-2xl rounded-bl-sm border-2 border-amber-400 bg-amber-50 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg">Семья</span>
          <span className="relative grid w-full max-w-80 grid-cols-[1fr_1.2fr_1fr] items-end gap-1">
            <img src="/games/characters/panda.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-28 w-full -rotate-6 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
            <img src="/games/characters/penguin.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-36 w-full object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-2" />
            <img src="/games/characters/pero.webp" alt="" loading="lazy" decoding="async" width="512" height="512" className="h-28 w-full rotate-6 object-contain drop-shadow-xl transition-transform duration-300 motion-safe:group-hover:-translate-y-1" />
          </span>
          <span className="relative mt-1 flex h-4 items-center gap-1 text-teal-950/60">
            {[4, 8, 13, 7, 16, 10, 6, 12, 16, 9, 5, 12, 7, 4, 8].map((height, index) => <span key={index} className="w-1 rounded-full bg-current" style={{ height }} />)}
          </span>
        </span>

        <span className="min-w-0">
          <strong id="tez-gapir-card-title" className="block text-2xl font-black sm:text-3xl">{label.title}</strong>
          <span className="mt-2 block text-sm leading-relaxed text-teal-50/90">{label.description}</span>
          <span className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-300 px-6 py-3 text-sm font-black text-[#123446] shadow-lg shadow-amber-950/20 transition-colors group-hover:from-amber-200 group-hover:to-orange-200">
              <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} /> {play}
            </span>
            <span className="text-xs font-bold text-teal-100/80">{copy.rounds}: 3–5</span>
          </span>
        </span>
      </span>
    </MotionLink>
  )
}
