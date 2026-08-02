import { LinkButton } from '../components/ui'

const MILESTONES = [
  { day: 7, text: 'O’zingizni tanishtirasiz va oddiy savollarga javob berasiz.' },
  { day: 30, text: 'Hamkasb va rahbar bilan qisqa suhbatni olib borasiz.' },
  { day: 90, text: 'Ish va kundalik vaziyatlarni mustaqil hal qilasiz.' },
]

export function Landing() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      {/* Same wordmark as the app shell, so the brand does not change at the door. */}
      <span className="text-xl font-semibold tracking-tight text-ink">
        russian<span className="text-signal">.gg</span>
      </span>

      <h1 className="mt-12 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
        90 kunda ish va kundalik hayot uchun rus tilida gapiring.
      </h1>

      <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
        Siz rus tilini tushunasiz, lekin gapirishga ishonchingiz yo’q. Bu yerda har kuni
        15–20 daqiqa ovozli mashq qilasiz — haqiqiy vaziyatlarda, o’zbek tilidagi qo’llab-quvvatlash bilan.
      </p>

      {/* Straight into the placement check, not into a sign-up form: the visitor should meet
          the product before they are asked to make an account. */}
      <div className="mt-9 flex flex-col gap-2 sm:flex-row sm:items-center">
        <LinkButton to="/onboarding">Darajangizni aniqlang · 2 daqiqa</LinkButton>
        {/* Borderless on purpose: one action carries the emphasis, the other stays quiet. */}
        <LinkButton to="/signin" variant="ghost">
          Kirish
        </LinkButton>
      </div>

      <ul className="mt-16 space-y-6 border-t border-hairline pt-8">
        {MILESTONES.map((milestone) => (
          <li key={milestone.day} className="flex gap-5">
            <span className="w-20 shrink-0 text-sm font-semibold tracking-[0.12em] whitespace-nowrap text-signal-ink uppercase">
              {milestone.day}-kun
            </span>
            <span className="text-base text-ink">{milestone.text}</span>
          </li>
        ))}
      </ul>

      {/*
        Said plainly on the first screen. The product must not imply certification or
        guaranteed fluency (PRD §4 "what Russian.gg is not").
      */}
      <p className="text-support mt-12 border-t border-hairline pt-6">
        Russian.gg — amaliy gapirish mashqi. Bu rasmiy til sertifikati yoki imtihonga
        tayyorgarlik kursi emas, va jonli o’qituvchi o’rnini bosmaydi.
      </p>
    </div>
  )
}
