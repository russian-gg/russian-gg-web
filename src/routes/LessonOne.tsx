import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, LinkButton, PauseGlyph, PlayGlyph, ProgressBar } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { cx } from '../lib/cx'
import {
  LESSON_ONE_SECTIONS as sections,
  lessonOneStorageKey,
} from '../lib/demo-lesson-one'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import type { LessonOneSection as LessonSection } from '../lib/demo-lesson-one'
import type { MissionSummary } from '../lib/types'

type LessonState = {
  sectionIndex: number
  completed: LessonSection[]
  phoneticAnswer: string | null
  grammarAnswer: string | null
  discoveredPhrases: number[]
  gameMatches: Record<string, string>
}

type LessonPhrase = {
  ru: string
  meaning: string
  character: '🐧' | '🐼' | '🪶'
  category: string
  tone: 'blue' | 'red' | 'yellow' | 'neutral'
}

const lessonPhrases: LessonPhrase[] = [
  { ru: 'Здравствуйте!', meaning: 'Assalomu alaykum!', character: '🪶', category: 'Salomlashish', tone: 'neutral' },
  { ru: 'Меня зовут Али.', meaning: 'Mening ismim Ali.', character: '🐧', category: 'Tanishtirish', tone: 'neutral' },
  { ru: 'А как вас зовут?', meaning: 'Sizning ismingiz nima?', character: '🪶', category: 'Savol', tone: 'neutral' },
  { ru: 'Я ваш сосед.', meaning: 'Men sizning qo‘shningizman.', character: '🐧', category: 'Tanishuv', tone: 'blue' },
  { ru: 'Это моя квартира.', meaning: 'Bu mening xonadonim.', character: '🐼', category: 'Uy', tone: 'red' },
  { ru: 'А это мой дом.', meaning: 'Bu esa mening uyim.', character: '🐧', category: 'Uy', tone: 'blue' },
  { ru: 'Очень приятно!', meaning: 'Juda yoqimli!', character: '🪶', category: 'Javob', tone: 'neutral' },
  { ru: 'Где вы живёте?', meaning: 'Siz qayerda yashaysiz?', character: '🪶', category: 'Savol', tone: 'neutral' },
  { ru: 'Я живу на пятом этаже.', meaning: 'Men beshinchi qavatda yashayman.', character: '🐧', category: 'Manzil', tone: 'blue' },
  { ru: 'А вы? — А я на втором.', meaning: 'Sizchi? — Men ikkinchi qavatda.', character: '🐧', category: 'Manzil', tone: 'blue' },
  { ru: 'Это ваш ключ?', meaning: 'Bu sizning kalitingizmi?', character: '🐧', category: 'Savol', tone: 'blue' },
  { ru: 'Да, это мой ключ.', meaning: 'Ha, bu mening kalitim.', character: '🐧', category: 'Javob', tone: 'blue' },
  { ru: 'Добро пожаловать!', meaning: 'Xush kelibsiz!', character: '🪶', category: 'Taklif', tone: 'neutral' },
  { ru: 'Я хочу пригласить вас на чай.', meaning: 'Men sizni choyga taklif qilmoqchiman.', character: '🐧', category: 'Taklif', tone: 'blue' },
  { ru: 'С удовольствием!', meaning: 'Mamnuniyat bilan!', character: '🪶', category: 'Rozilik', tone: 'yellow' },
]

const dialogue = [
  ['🐧 Пингвин: — Здравствуйте! Меня зовут Пингвин. Я ваш сосед.', '🐼 Панда: — Очень приятно! А меня Панда. Это моя квартира.'],
  ['🐧 Пингвин: — А это мой дом. Я живу на пятом этаже.', '🐼 Панда: — А я на втором. Где вы живёте?'],
  ['🐧 Пингвин: — На пятом. Это ваш ключ?', '🐼 Панда: — Да, мой.'],
  ['🐧 Пингвин: — Добро пожаловать! Я хочу пригласить вас на чай.', '🐼 Панда: — С удовольствием!'],
]

const aiQuestions = [
  { question: 'Как вас зовут?', answer: 'Меня зовут [ism].' },
  { question: 'Кто вы?', answer: 'Я сосед. / Я ваш сосед.' },
  { question: 'Где вы живёте?', answer: 'Я живу на пятом этаже.' },
  { question: 'Это ваш ключ?', answer: 'Да, это мой ключ.' },
  { question: 'Что вы хотите?', answer: 'Я хочу пригласить вас на чай.' },
  { question: 'Вы согласны?', answer: 'С удовольствием!' },
]

const vocabulary = [
  { phrase: 'здравствуйте', meaning: 'assalomu alaykum', transliteration: 'zdravstvuyte', example: 'Здравствуйте! Я ваш сосед.', tone: 'neutral', icon: '👋' },
  { phrase: 'привет', meaning: 'salom', transliteration: 'privet', example: 'Привет! Как вас зовут?', tone: 'neutral', icon: '👋' },
  { phrase: 'добро пожаловать', meaning: 'xush kelibsiz', transliteration: 'dobro pozhalovat', example: 'Добро пожаловать в мой дом!', tone: 'neutral', icon: '🏠' },
  { phrase: 'меня зовут…', meaning: 'mening ismim…', transliteration: 'menya zovut', example: 'Меня зовут Али.', tone: 'neutral', icon: '🪪' },
  { phrase: 'как вас зовут?', meaning: 'ismingiz nima?', transliteration: 'kak vas zovut', example: 'Здравствуйте! Как вас зовут?', tone: 'neutral', icon: '❓' },
  { phrase: 'очень приятно', meaning: 'tanishganimdan xursandman', transliteration: 'ochen priyatno', example: 'Очень приятно! Я ваш сосед.', tone: 'neutral', icon: '🤝' },
  { phrase: 'сосед', meaning: 'qo‘shni', transliteration: 'sosed', example: 'Это мой сосед.', tone: 'blue', icon: '🐧' },
  { phrase: 'квартира', meaning: 'kvartira, xonadon', transliteration: 'kvartira', example: 'Это моя квартира.', tone: 'red', icon: '🐼' },
  { phrase: 'дом', meaning: 'uy', transliteration: 'dom', example: 'А это мой дом.', tone: 'blue', icon: '🏠' },
  { phrase: 'этаж', meaning: 'qavat', transliteration: 'etazh', example: 'Я живу на пятом этаже.', tone: 'blue', icon: '🏢' },
  { phrase: 'ключ', meaning: 'kalit', transliteration: 'klyuch', example: 'Это мой ключ.', tone: 'blue', icon: '🔑' },
  { phrase: 'я хочу…', meaning: 'men xohlayman…', transliteration: 'ya khochu', example: 'Я хочу пригласить вас на чай.', tone: 'neutral', icon: '💬' },
  { phrase: 'пригласить', meaning: 'taklif qilmoq', transliteration: 'priglasit', example: 'Я хочу пригласить соседа.', tone: 'neutral', icon: '🫖' },
  { phrase: 'чай', meaning: 'choy', transliteration: 'chay', example: 'Приглашаю вас на чай.', tone: 'blue', icon: '🍵' },
  { phrase: 'с удовольствием', meaning: 'mamnuniyat bilan', transliteration: 's udovolstviyem', example: 'С удовольствием!', tone: 'yellow', icon: '✨' },
] as const

const genderBoxes = [
  { id: 'masculine', label: 'Мужской род', color: 'Ko‘k', character: '🐧', className: 'border-signal bg-signal-soft text-signal-ink' },
  { id: 'feminine', label: 'Женский род', color: 'Qizil', character: '🐼', className: 'border-danger bg-danger-soft text-danger' },
  { id: 'neuter', label: 'Средний род', color: 'Sariq', character: '🪶', className: 'border-caution bg-caution-soft text-caution' },
] as const

const gameWords = [
  { id: 'dom', word: 'дом', stressed: 'до́м', answer: 'masculine' },
  { id: 'kvartira', word: 'квартира', stressed: 'кварти́ра', answer: 'feminine' },
  { id: 'okno', word: 'окно', stressed: 'окно́', answer: 'neuter' },
  { id: 'sosed', word: 'сосед', stressed: 'сосе́д', answer: 'masculine' },
  { id: 'klyuch', word: 'ключ', stressed: 'клю́ч', answer: 'masculine' },
  { id: 'chay', word: 'чай', stressed: 'ча́й', answer: 'masculine' },
  { id: 'etazh', word: 'этаж', stressed: 'эта́ж', answer: 'masculine' },
  { id: 'lestnitsa', word: 'лестница', stressed: 'ле́стница', answer: 'feminine' },
  { id: 'dver', word: 'дверь', stressed: 'две́рь', answer: 'feminine' },
  { id: 'komnata', word: 'комната', stressed: 'ко́мната', answer: 'feminine' },
] as const

const emptyState: LessonState = {
  sectionIndex: 0,
  completed: [],
  phoneticAnswer: null,
  grammarAnswer: null,
  discoveredPhrases: [],
  gameMatches: {},
}

export function LessonOne() {
  const { missionId } = useParams<{ missionId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const storageKey = user ? lessonOneStorageKey(user.id) : null
  const [state, setState] = useState<LessonState>(() => loadState(storageKey))
  const active = sections[state.sectionIndex] ?? sections[0]
  const { data: practiceMissions, isLoading: isPracticeLoading, isError: isPracticeError } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
    enabled: active.id === 'missions',
  })
  const completedCount = sections.filter((section) => state.completed.includes(section.id)).length
  const dialogueMissionId = practiceMissions?.find(
    (mission) => mission.slug === 'practice-day-01-acquaintance-dialogue',
  )?.id

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify(state))
    window.dispatchEvent(new Event('rgg:lesson-one-progress'))
  }, [state, storageKey])

  useEffect(() => {
    if (active.id !== 'complete' || !missionId) return

    void syncLessonOneCompletion(missionId).then(() => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course-map'] }),
      queryClient.invalidateQueries({ queryKey: ['day-missions'] }),
      queryClient.invalidateQueries({ queryKey: ['progress'] }),
      queryClient.invalidateQueries({ queryKey: ['home'] }),
    ])).catch(() => {
      // A later visit retries the idempotent sync; the completed browser lesson is preserved.
    })
  }, [active.id, missionId, queryClient])

  const gameSolved = useMemo(
    () => gameWords.every((word) => state.gameMatches[word.id] === word.answer),
    [state.gameMatches],
  )

  const canContinue =
    active.id === 'tests'
      ? state.phoneticAnswer === 'a' && state.grammarAnswer === 'a'
      : active.id === 'phrases'
        ? state.discoveredPhrases.length === lessonPhrases.length
        : active.id === 'game'
          ? gameSolved
          : true

  function visitSection(index: number) {
    setState((current) => ({
      ...current,
      sectionIndex: index,
      completed:
        sections[index]?.id === 'complete' && !current.completed.includes('complete')
          ? [...current.completed, 'complete']
          : current.completed,
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function completeAndContinue() {
    setState((current) => ({
      ...current,
      sectionIndex: Math.min(current.sectionIndex + 1, sections.length - 1),
      completed: Array.from(new Set([
        ...current.completed,
        active.id,
        ...(current.sectionIndex + 1 === sections.length - 1 ? ['complete' as const] : []),
      ])),
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function markMissionsComplete() {
    setState((current) => ({
      ...current,
      completed: current.completed.includes('missions')
        ? current.completed
        : [...current.completed, 'missions'],
    }))
  }

  function resetLesson() {
    setState(emptyState)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="mx-auto -mt-5 max-w-5xl pb-12 md:mt-0">
      <header className="rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5 sm:p-6">
        <p className="text-xs font-black tracking-[0.16em] text-signal-ink uppercase">1-dars · A1</p>
        <h1 className="mt-1 text-2xl font-black text-ink sm:text-3xl">Знакомство с соседом</h1>
        <p className="mt-1 text-sm font-semibold text-ink-muted">Qo‘shni bilan tanishuv</p>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="mt-5 text-sm font-extrabold text-ink">Dars progressi</p>
          <p className="text-xs font-bold tracking-wide text-ink-faint uppercase">
            {completedCount} / {sections.length} bo‘lim yakunlandi
          </p>
        </div>
        <div className="mt-3">
          <ProgressBar
            value={completedCount}
            max={sections.length}
            label="Dars bo‘yicha umumiy natija"
          />
        </div>
      </header>

      <main className="mt-2">
        <div className="mb-5">
          <p className="text-xs font-black tracking-[0.16em] text-signal-ink uppercase">
            {active.eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black text-ink sm:text-3xl">
            {active.title}
          </h2>
        </div>

        {active.id === 'tests' && <TestsSection state={state} setState={setState} />}
        {active.id === 'phonetics' && <PhoneticsSection />}
        {active.id === 'grammar' && <GrammarSection />}
        {active.id === 'phrases' && <PhrasesSection state={state} setState={setState} />}
        {active.id === 'game' && <GameSection state={state} setState={setState} solved={gameSolved} />}
        {active.id === 'missions' && (
          <MissionsSection
            lessonMissionId={missionId}
            dialogueMissionId={dialogueMissionId}
            isLoading={isPracticeLoading}
            hasError={isPracticeError}
            onStartMission={markMissionsComplete}
          />
        )}
        {active.id === 'vocabulary' && <VocabularySection />}
        {active.id === 'picture' && <PictureExerciseSection />}
        {active.id === 'complete' && <CompleteSection missionId={missionId} onReset={resetLesson} />}
      </main>

      <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          disabled={state.sectionIndex === 0}
          onClick={() => visitSection(state.sectionIndex - 1)}
        >
          ← Orqaga
        </Button>

        {state.sectionIndex < sections.length - 1 && (
          <div className="sm:text-right">
            <Button size="lg" block disabled={!canContinue} onClick={completeAndContinue}>
              Davom etish →
            </Button>
            {!canContinue && (
              <p className="mt-2 text-xs text-ink-muted">
                {active.id === 'tests'
                  ? 'Davom etish uchun ikki testga to‘g‘ri javob bering.'
                  : active.id === 'phrases'
                    ? 'Davom etish uchun barcha 15 iborani oching va tinglang.'
                    : 'Davom etish uchun 10 ta so‘zni to‘g‘ri rangli uyga joylang.'}
              </p>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

function TestsSection({ state, setState }: { state: LessonState; setState: SetLessonState }) {
  return (
    <div className="space-y-5">
      <QuizCard
        number="01"
        character="🪶 Перо"
        question='Quyidagi variantlardan qaysi birida «мама» so‘zi to‘g‘ri talaffuz qilingan?'
        answer={state.phoneticAnswer}
        correct="a"
        options={[
          ['a', 'ма́ма — urg‘u birinchi bo‘g‘inda'],
          ['b', 'мама́ — urg‘u ikkinchi bo‘g‘inda'],
        ]}
        feedback="Siz birinchi bo‘g‘inga urg‘u qo‘yganingizni eshitdim. Juda zo‘r! Rus tilida «мама» so‘zida urg‘u faqat birinchi bo‘g‘inda: ма́ма."
        onAnswer={(answer) => setState((current) => ({ ...current, phoneticAnswer: answer }))}
      />

      <QuizCard
        number="02"
        character="🐧 Пингвин"
        question='Quyidagi so‘zlardan qaysi biri мужской родga kiradi?'
        answer={state.grammarAnswer}
        correct="a"
        options={[
          ['a', 'дом', 'blue'],
          ['b', 'квартира', 'red'],
          ['c', 'окно', 'yellow'],
        ]}
        feedback="To‘g‘ri! «Дом» — мужской род, shuning uchun u ko‘k rangda. So‘z oxirida undosh yoki «-й» bo‘lsa, odatda мужской род bo‘ladi."
        onAnswer={(answer) => setState((current) => ({ ...current, grammarAnswer: answer }))}
      />
    </div>
  )
}

function PhoneticsSection() {
  const vowels = [
    {
      letter: 'А',
      character: '🐼 Панда',
      description: 'Og‘iz keng ochiladi, til pastda yotadi. O‘zbek tilidagi «a»ga o‘xshaydi, ammo urg‘uli А yanada aniq va cho‘ziq eshitiladi.',
      examples: ['ма́ма', 'па́па', 'па́нда'],
      className: 'border-danger bg-danger-soft',
      accentClass: 'text-danger',
    },
    {
      letter: 'О',
      character: '🪶 Перо',
      description: 'Lablar dumaloqlanadi, til orqaga tortiladi. Urg‘uli О o‘zbekcha «o»dan chuqurroq va aniqroq eshitiladi.',
      examples: ['до́м', 'сто́л', 'по́рт'],
      className: 'border-caution bg-caution-soft',
      accentClass: 'text-caution',
    },
    {
      letter: 'У',
      character: '🐧 Пингвин',
      description: 'Lablar oldinga cho‘zilib, trubka shaklini hosil qiladi. O‘zbek tilidagi «u» bilan deyarli bir xil.',
      examples: ['сту́л', 'му́ж'],
      className: 'border-signal bg-signal-soft',
      accentClass: 'text-signal-ink',
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="border-signal bg-signal-soft p-6 sm:p-8">
        <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">A, O, U va urg‘u</p>
        <h3 className="mt-2 text-2xl font-black text-ink">Urg‘uli unlini aniq va cho‘ziq ayting</h3>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-muted">
          Rus tilida unlilar urg‘uli va urg‘usiz holatda turlicha talaffuz qilinadi. Hozir urg‘uli
          unlilarni mashq qilamiz. Urg‘u so‘z ma’nosini ham o‘zgartirishi mumkin:
          <strong className="text-ink"> за́мок</strong> — qal’a, <strong className="text-ink">замо́к</strong> — qulf.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {vowels.map((vowel) => (
          <Card key={vowel.letter} className={cx('border-2 p-6', vowel.className)}>
            <div className="flex items-center justify-between gap-3">
              <span className={cx('text-5xl font-black', vowel.accentClass)}>{vowel.letter}</span>
              <span className="text-sm font-black text-ink-muted">{vowel.character}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink">{vowel.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {vowel.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => speakRussian(example)}
                  className="inline-flex items-center gap-2 rounded-full bg-ground-raised px-3 py-2 font-black text-ink shadow-sm"
                >
                  <PlayGlyph /> {example}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 text-center sm:p-8">
        <p className="text-3xl" aria-hidden="true">🐼</p>
        <p className="mt-3 font-black text-ink">
          Har bir yangi so‘zni tinglaganda, urg‘uli bo‘g‘inni balandroq va cho‘ziqroq ayting!
        </p>
      </Card>
    </div>
  )
}

function GrammarSection() {
  const genders = [
    {
      character: '🐧',
      title: 'Мужской род',
      color: 'Ko‘k qirollik',
      endings: 'undosh yoki -й',
      examples: 'дом, сосед, ключ',
      anchor: 'он мой',
      className: 'border-signal bg-signal-soft',
      accentClass: 'text-[#084fbd]',
    },
    {
      character: '🐼',
      title: 'Женский род',
      color: 'Qizil qirollik',
      endings: '-а, -я, -ь',
      examples: 'квартира, лестница, дверь',
      anchor: 'она моя',
      className: 'border-danger bg-danger-soft',
      accentClass: 'text-[#e0001b]',
    },
    {
      character: '🪶',
      title: 'Средний род',
      color: 'Sariq qirollik',
      endings: '-о, -е, -ё',
      examples: 'окно, море, ружьё',
      anchor: 'оно моё',
      className: 'border-caution bg-caution-soft',
      accentClass: 'text-[#c88b00]',
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-signal/25 p-0">
        <div className="bg-[linear-gradient(135deg,var(--color-signal-soft),var(--color-ground-raised))] p-6 sm:p-8">
          <p className="text-xs font-black tracking-[0.16em] text-signal-ink uppercase">
            Rodlar haqida ertak
          </p>
          <h3 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
            Rodlar qirolliklariga xush kelibsiz!
          </h3>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-muted">
            Olis zamonlarda <strong className="text-ink">OT (имя существительное)</strong> nomli
            katta qirollik bo‘lgan va uning ichiga hamma “kim?” hamda “nima?” savollariga javob
            bo‘ladigan so‘zlar kirgan ekan. So‘zlar shunchalik ko‘p ekanki, ularni boshqarish
            qiyinlashibdi. Shunda barcha otlar uchta kichik qirollikka ajratilib saralanibdi.
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-3">
          <article className="rounded-2xl border-2 border-signal bg-signal-soft p-5">
            <p className="font-black text-[#084fbd]">🐧 Pingvin qirolligi · Мужской род</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Undosh harf yoki <strong>-й</strong> bilan tugagan so‘zlarni o‘z ichiga tanlab olibdi
              (misol uchun, <strong>дом, сосед, ключ</strong>). Ular faxr bilan:
              <strong className="text-[#084fbd]"> “он мой”</strong> deyishadi.
            </p>
          </article>

          <article className="rounded-2xl border-2 border-danger bg-danger-soft p-5">
            <p className="font-black text-[#e0001b]">🐼 Panda qirolligi · Женский род</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              <strong>-а, -я, -ь</strong> harflari bilan tugagan so‘zlarni o‘z hududiga kirgizibdi
              (masalan, <strong>квартира, лестница, дверь</strong>). Ular ohista shivirlashadi:
              <strong className="text-[#e0001b]"> “она моя”</strong>.
            </p>
          </article>

          <article className="rounded-2xl border-2 border-caution bg-caution-soft p-5">
            <p className="font-black text-[#c88b00]">🪶 Pat qirolligi · Средний род</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Jonsiz narsalardan aynan <strong>-о, -е, -ё</strong> harflari bilan tugaganlarini
              saralab olibdi (masalan, <strong>окно, море, ружьё</strong>). Ular ishonch bilan:
              <strong className="text-[#c88b00]"> “оно моё”</strong> deb aytadi.
            </p>
          </article>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          {genders.map((gender) => (
            <article key={gender.title} className={cx('rounded-2xl border-2 p-5', gender.className)}>
              <span className="text-4xl" aria-hidden="true">{gender.character}</span>
              <p className={cx('mt-3 text-xs font-black tracking-wider uppercase', gender.accentClass)}>
                {gender.color}
              </p>
              <h3 className={cx('mt-1 text-xl font-black', gender.accentClass)}>{gender.title}</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <LearnRow label="Tugashi" value={gender.endings} />
                <LearnRow label="Misollar" value={gender.examples} />
                <LearnRow label="Kalit" value={gender.anchor} />
              </dl>
            </article>
          ))}
        </div>
      </Card>

      <Card className="border-signal bg-signal-soft p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="text-5xl" aria-hidden="true">🐧</span>
          <div>
            <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">Pingvin eslatmasi</p>
            <p className="mt-2 leading-relaxed text-ink">
              Rangni so‘zning oxiriga qarab tanlang: <strong className="text-signal-ink">ko‘k — мужской</strong>,
              <strong className="text-danger"> qizil — женский</strong>,
              <strong className="text-caution"> sariq — средний</strong>. <strong>дверь</strong> kabi
              yumshatish belgisi bilan tugagan so‘zlarni lug‘at bilan tekshirish kerak.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function PhrasesSection({ state, setState }: { state: LessonState; setState: SetLessonState }) {
  const [speakingPhraseIndex, setSpeakingPhraseIndex] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  function discover(index: number) {
    setState((current) => ({
      ...current,
      discoveredPhrases: current.discoveredPhrases.includes(index)
        ? current.discoveredPhrases
        : [...current.discoveredPhrases, index],
    }))
  }

  function togglePhrasePlayback(index: number, text: string) {
    if (!('speechSynthesis' in window)) return

    if (speakingPhraseIndex === index) {
      window.speechSynthesis.cancel()
      setSpeakingPhraseIndex(null)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ru-RU'
    utterance.rate = 0.84
    utterance.onend = () => {
      setSpeakingPhraseIndex((current) => (current === index ? null : current))
    }
    utterance.onerror = () => {
      setSpeakingPhraseIndex((current) => (current === index ? null : current))
    }
    setSpeakingPhraseIndex(index)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-caution bg-[linear-gradient(180deg,#fff7da,var(--color-ground-raised))] p-0">
        <div className="relative min-h-64 overflow-hidden px-6 pt-8 text-center">
          <div className="absolute top-5 left-8 size-14 rounded-full bg-[#f8c84b] shadow-[0_0_0_14px_rgba(248,200,75,.15)]" />
          <div className="absolute right-8 bottom-5 text-7xl opacity-80" aria-hidden="true">🌳</div>
          <div className="relative mx-auto mt-9 max-w-xl rounded-t-[64px] border-8 border-b-0 border-[#9a5f36] bg-[#f2c382] px-5 pt-8 pb-4 shadow-soft">
            <div className="mx-auto w-fit rounded-full bg-[#57371f] px-5 py-2 text-sm font-black tracking-widest text-white uppercase">Дом</div>
            <div className="mt-7 flex justify-center gap-4">
              <span className="h-24 w-16 rounded-t-full bg-[#5b9bf5]/70" />
              <span className="h-24 w-16 rounded-t-full bg-[#c8342a]/65" />
              <span className="h-24 w-16 rounded-t-full bg-[#5b9bf5]/70" />
            </div>
          </div>
        </div>
        <div className="border-t-2 border-caution bg-ground-raised px-5 py-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-ink">15 ta asosiy iborani oching</p>
            <p className="text-sm text-ink-muted">Vaziyat kartasini oching, 🎧 orqali tinglang va ovoz chiqarib takrorlang.</p>
          </div>
          <p className="mt-2 text-lg font-black text-caution sm:mt-0">{state.discoveredPhrases.length} / 15</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lessonPhrases.map((phrase, index) => {
          const discovered = state.discoveredPhrases.includes(index)
          return (
            <article
              key={phrase.ru}
              className={cx(
                'min-h-40 rounded-[var(--radius-card)] border-2 p-5 text-left transition duration-200',
                discovered
                  ? 'border-signal bg-ground-raised shadow-[0_4px_0_0_var(--color-control-depth)]'
                  : 'border-dashed border-hairline bg-ground-sunken hover:border-signal',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-2xl" aria-hidden="true">{discovered ? phrase.character : '❓'}</span>
                <span className="text-xs font-black text-ink-faint">#{index + 1}</span>
              </div>
              <p className="mt-3 text-xs font-bold tracking-wide text-ink-muted uppercase">{phrase.category}</p>
              {discovered ? (
                <>
                  <p className={cx(
                    'mt-2 text-lg font-black leading-snug',
                    phrase.tone === 'blue'
                      ? 'text-signal-ink'
                      : phrase.tone === 'red'
                        ? 'text-danger'
                        : phrase.tone === 'yellow'
                          ? 'text-caution'
                          : 'text-ink',
                  )}>{phrase.ru}</p>
                  <p className="mt-1 text-sm text-ink-muted">{phrase.meaning}</p>
                  <button
                    type="button"
                    onClick={() => togglePhrasePlayback(index, phrase.ru)}
                    aria-label={speakingPhraseIndex === index ? 'Tinglashni to‘xtatish' : 'Tinglash'}
                    aria-pressed={speakingPhraseIndex === index}
                    className={cx(
                      'mt-3 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-black text-signal-ink transition',
                      speakingPhraseIndex === index && 'bg-signal-soft',
                    )}
                  >
                    {speakingPhraseIndex === index ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-signal text-on-signal">
                        <PauseGlyph />
                      </span>
                    ) : (
                      <PlayGlyph />
                    )}
                    Tinglash
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => discover(index)}
                  className="mt-4 rounded-full bg-signal-soft px-4 py-2 text-sm font-extrabold text-signal-ink hover:bg-signal hover:text-on-signal"
                >
                  Iborani ochish
                </button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function GameSection({
  state,
  setState,
  solved,
}: {
  state: LessonState
  setState: SetLessonState
  solved: boolean
}) {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const correctCount = gameWords.filter((word) => state.gameMatches[word.id] === word.answer).length

  function placeWord(wordId: string, genderId: string) {
    const word = gameWords.find((candidate) => candidate.id === wordId)
    if (!word) return
    if (genderId === word.answer && state.gameMatches[word.id] !== word.answer) {
      celebrateCorrectAnswer()
    }
    setState((current) => ({
      ...current,
      gameMatches: { ...current.gameMatches, [word.id]: genderId },
    }))
    setSelectedWordId(null)
  }

  return (
    <div className="space-y-5">
      <Card className="bg-ink text-ground-raised">
        <p className="text-xs font-black tracking-[0.15em] text-signal uppercase">O‘yin qoidasi</p>
        <p className="mt-2 max-w-3xl text-lg leading-relaxed">
          So‘zni to‘g‘ri rangli uyga sudrang. Telefonda so‘zni, keyin rangli uyni bosing.
          Har bir to‘g‘ri javob — 10 ball.
        </p>
        <p className="mt-3 text-sm text-ground-raised/75">
          🎧 tugmasi orqali urg‘uni tinglang va ovoz chiqarib takrorlang. AI missiyasida to‘g‘ri urg‘u alohida tekshiriladi.
        </p>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-black text-ink">So‘zlar</p>
          <p className="rounded-full bg-signal-soft px-4 py-2 font-black text-signal-ink">
            {correctCount * 10} / {gameWords.length * 10} ball
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {gameWords.map((word) => {
            const placed = state.gameMatches[word.id]
            const correct = placed === word.answer
            const selected = selectedWordId === word.id
            return (
              <div
                key={word.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', word.id)}
                className={cx(
                  'flex items-center gap-2 rounded-2xl border-2 bg-ground-raised px-3 py-2 shadow-sm transition',
                  selected
                    ? 'border-signal ring-2 ring-signal/25'
                    : placed
                      ? correct ? 'border-milestone' : 'border-danger'
                      : 'border-hairline',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedWordId((current) => current === word.id ? null : word.id)}
                  className="font-black text-ink"
                  aria-pressed={selected}
                >
                  {word.word}
                </button>
                <button
                  type="button"
                  onClick={() => speakRussian(word.stressed)}
                  aria-label={`${word.word} talaffuzini tinglash`}
                  className="flex size-7 items-center justify-center rounded-full bg-signal-soft text-signal-ink"
                >
                  <PlayGlyph />
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {genderBoxes.map((box) => {
          const wordsInBox = gameWords.filter((word) => state.gameMatches[word.id] === box.id)
          return (
            <button
              key={box.id}
              type="button"
              onClick={() => selectedWordId && placeWord(selectedWordId, box.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                placeWord(event.dataTransfer.getData('text/plain'), box.id)
              }}
              className={cx(
                'min-h-56 rounded-[var(--radius-card)] border-2 border-dashed p-5 text-left transition hover:-translate-y-0.5',
                box.className,
              )}
            >
              <span className="text-4xl" aria-hidden="true">{box.character}</span>
              <span className="mt-3 block text-xs font-black tracking-[0.14em] uppercase">{box.color} uy</span>
              <span className="mt-1 block text-xl font-black">{box.label}</span>
              <span className="mt-5 flex flex-wrap gap-2">
                {wordsInBox.length === 0 && (
                  <span className="text-sm font-semibold opacity-70">So‘zni shu yerga tashlang</span>
                )}
                {wordsInBox.map((word) => {
                  const correct = word.answer === box.id
                  return (
                    <span
                      key={word.id}
                      className={cx(
                        'rounded-full bg-ground-raised px-3 py-1.5 text-sm font-black shadow-sm',
                        correct ? 'text-milestone' : 'text-danger',
                      )}
                    >
                      {word.word} {correct ? '✓' : '— qayta urinib ko‘ring'}
                    </span>
                  )
                })}
              </span>
            </button>
          )
        })}
      </div>

      {solved && (
        <div role="status" className="rounded-2xl bg-milestone-soft px-5 py-4 text-center font-black text-milestone">
          ✓ Ajoyib! 10 ta so‘zning rodi to‘g‘ri topildi — {gameWords.length * 10} ball.
        </div>
      )}
    </div>
  )
}

function MissionsSection({
  lessonMissionId,
  dialogueMissionId,
  isLoading,
  hasError,
  onStartMission,
}: {
  lessonMissionId?: string
  dialogueMissionId?: string
  isLoading: boolean
  hasError: boolean
  onStartMission: () => void
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="p-6">
        <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">Namunaviy dialog</p>
        <div className="mt-5 space-y-4">
          {dialogue.map(([first, second], index) => (
            <div key={first} className="space-y-2">
              <p className="rounded-2xl rounded-bl-sm bg-ground-sunken px-4 py-3 text-sm leading-relaxed text-ink">{first}</p>
              {second && (
                <p className="ml-8 rounded-2xl rounded-br-sm bg-signal-soft px-4 py-3 text-sm leading-relaxed text-ink">{second}</p>
              )}
              {index < dialogue.length - 1 && <span className="sr-only">Keyingi replikalar</span>}
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">AI sizdan so‘raydi</p>
          <ol className="mt-4 space-y-3">
            {aiQuestions.map((item, index) => (
              <li key={item.question} className="flex gap-3 text-sm leading-snug text-ink">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-signal-soft text-xs font-black text-signal-ink">{index + 1}</span>
                <span>
                  <strong className="block">{item.question}</strong>
                  <span className="mt-1 block text-xs text-ink-muted">Kutilgan javob: {item.answer}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-2xl bg-ground-sunken p-3 text-xs leading-relaxed text-ink-muted">
            AI urg‘u (сосе́д, кварти́ра, этаже́), unlilar talaffuzi va javobning to‘liqligini tekshiradi.
          </p>
        </Card>

        <Card className="border-signal bg-signal-soft text-center">
          <div className="text-5xl" aria-hidden="true">🎙️</div>
          <h3 className="mt-3 text-xl font-black text-ink">Ovozli missiyaga tayyormisiz?</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            AI yuqoridagi 6 ta savolni ketma-ket beradi. Siz mikrofon orqali javob berasiz;
            AI urg‘u, talaffuz va javobning to‘liqligini tekshiradi.
          </p>
          {lessonMissionId && (
            <LinkButton to={`/missions/${lessonMissionId}`} block className="mt-5" onClick={onStartMission}>
              🎙️ 6 ta AI savolini boshlash
            </LinkButton>
          )}
          <div className="mt-5 border-t border-signal/20 pt-5">
            <p className="text-xs font-bold text-ink-muted">Yuqoridagi namunaviy dialogni rollarga bo‘lib mashq qiling:</p>
            {dialogueMissionId ? (
              <LinkButton to={`/missions/${dialogueMissionId}`} block variant="secondary" className="mt-3" onClick={onStartMission}>
                🐧🐼 Dialogni AI bilan mashq qilish
              </LinkButton>
            ) : isLoading ? (
              <p className="mt-3 text-sm font-bold text-ink-muted">Dialog tayyorlanmoqda…</p>
            ) : hasError ? (
              <p className="mt-3 text-sm font-bold text-danger">Dialogni yuklab bo‘lmadi. Sahifani yangilab ko‘ring.</p>
            ) : (
              <p className="mt-3 text-sm font-bold text-danger">Dialog missiyasi topilmadi.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function VocabularySection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    if (activeIndex === null) return

    const previousOverflow = document.body.style.overflow
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveIndex(null)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [activeIndex])

  function openWord(index: number) {
    setActiveIndex(index)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-center text-sm leading-relaxed text-ink-muted">
        Bitta kartani oching, tarjimasini ko‘ring va bilganingizni belgilang.
      </p>

      <div className="relative mx-auto mt-8 max-w-xl px-2 pb-6 pt-3 sm:px-8">
        <div className="absolute inset-x-10 bottom-1 top-10 rotate-3 rounded-[2rem] border-2 border-hairline bg-ground-sunken" />
        <div className="absolute inset-x-7 bottom-4 top-6 -rotate-2 rounded-[2rem] border-2 border-hairline bg-ground-raised shadow-sm" />
        <button
          type="button"
          onClick={() => openWord(0)}
          className="group relative w-full overflow-hidden rounded-[2rem] border-2 border-signal bg-ground-raised text-left shadow-[0_10px_30px_rgba(30,89,170,.16)] transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(30,89,170,.22)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-signal"
        >
          <VocabularyPhoto index={0} className="block aspect-[16/9] w-full" />
          <span className="block p-5 sm:p-6">
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs font-black tracking-[0.14em] text-signal-ink uppercase">
                {vocabulary.length} ta karta
              </span>
              <span className="rounded-full bg-signal-soft px-3 py-1 text-xs font-black text-signal-ink">
                Bosib oching
              </span>
            </span>
            <span className="mt-3 block text-2xl font-black text-ink sm:text-3xl">Yangi so‘zlar kolodasi</span>
            <span className="mt-2 block text-sm leading-relaxed text-ink-muted">
              Tarjima kartaning orqa tomonida. Bilganingiz o‘ngga, bilmaganingiz chapga ketadi.
            </span>
            <span className="mt-5 flex h-12 items-center justify-center rounded-full bg-signal px-5 font-black text-on-signal shadow-[0_4px_0_0_var(--color-signal-depth)] transition group-active:translate-y-1 group-active:shadow-none">
              Kartalarni boshlash →
            </span>
          </span>
        </button>
      </div>

      {activeIndex !== null && (
        <VocabularyStudy
          initialIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  )
}

function VocabularyStudy({
  initialIndex,
  onClose,
}: {
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [isFlipped, setIsFlipped] = useState(false)
  const [exit, setExit] = useState<VocabularyRating | null>(null)
  const [knownCount, setKnownCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const word = vocabulary[index]

  function rate(rating: VocabularyRating) {
    if (exit) return
    setExit(rating)
    if (rating === 'known') setKnownCount((count) => count + 1)
    if (rating === 'unknown') setUnknownCount((count) => count + 1)

    window.setTimeout(() => {
      if (index >= vocabulary.length - 1) {
        setIsFinished(true)
      } else {
        setIndex((current) => current + 1)
      }
      setIsFlipped(false)
      setExit(null)
    }, 320)
  }

  function restart() {
    setIndex(0)
    setIsFlipped(false)
    setExit(null)
    setKnownCount(0)
    setUnknownCount(0)
    setIsFinished(false)
  }

  const cardTransform = exit
    ? `${vocabularyExitTransform(exit)} ${isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}`
    : isFlipped
      ? 'rotateY(180deg)'
      : 'rotateY(0deg)'

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-ground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocabulary-word"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <span className="text-sm font-extrabold text-ink-muted">
              {isFinished ? vocabulary.length : index + 1} / {vocabulary.length}
            </span>
            <span className="ml-3 text-xs font-bold text-ink-faint">
              ✓ {knownCount} &nbsp; · &nbsp; ? {unknownCount}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex size-11 items-center justify-center rounded-full border-2 border-hairline bg-ground-raised text-2xl font-bold text-ink hover:border-ink-faint"
          >
            ×
          </button>
        </div>

        {isFinished ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-milestone-soft text-4xl text-milestone">✓</div>
            <h2 id="vocabulary-word" className="mt-5 text-3xl font-black text-ink">Koloda tugadi</h2>
            <p className="mt-3 max-w-md leading-relaxed text-ink-muted">
              {knownCount} ta so‘zni bildingiz, {unknownCount} tasini yana mashq qilasiz.
              Qolgan kartalar takrorlash uchun saqlandi.
            </p>
            <div className="mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <Button size="lg" block onClick={restart}>Qayta boshlash</Button>
              <Button size="lg" block variant="secondary" onClick={onClose}>Yopish</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col justify-center py-6 text-center sm:py-8">
              <div className="mx-auto w-full max-w-xl [perspective:1200px]">
                <div
                  className={cx(
                    'relative min-h-[29rem] w-full cursor-pointer transition-[transform,opacity] duration-300 ease-out sm:min-h-[33rem]',
                    exit && 'opacity-0',
                  )}
                  style={{ transform: cardTransform, transformStyle: 'preserve-3d' }}
                  role="button"
                  tabIndex={0}
                  aria-label={isFlipped ? 'Kartaning old tomonini ko‘rish' : 'Tarjimani ko‘rish'}
                  onClick={() => setIsFlipped((flipped) => !flipped)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setIsFlipped((flipped) => !flipped)
                    }
                  }}
                >
                  <div
                    className="absolute inset-0 overflow-hidden rounded-[2rem] border-2 border-hairline bg-ground-raised shadow-[0_18px_50px_rgba(20,35,60,.18)]"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <VocabularyPhoto index={index} className="block aspect-[16/10] w-full" />
                    <div className="p-6 sm:p-8">
                      <p className="text-xs font-black tracking-[0.14em] text-signal-ink uppercase">Ruscha ibora</p>
                      <h2
                        id="vocabulary-word"
                        className={cx('mt-3 text-3xl font-black sm:text-4xl', vocabularyTextClass(word.tone))}
                      >
                        {word.phrase}
                      </h2>
                      <p className="mt-3 text-sm font-bold text-ink-faint">Kartani bosing — tarjimasini ko‘ring</p>
                    </div>
                  </div>

                  <div
                    className={cx(
                      'absolute inset-0 overflow-hidden rounded-[2rem] border-2 bg-ground-raised shadow-[0_18px_50px_rgba(20,35,60,.18)]',
                      word.tone === 'blue'
                        ? 'border-signal'
                        : word.tone === 'red'
                          ? 'border-danger'
                          : word.tone === 'yellow'
                            ? 'border-[#f1b900]'
                            : 'border-hairline',
                    )}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <VocabularyPhoto index={index} className="block h-40 w-full sm:h-48" />
                    <div className="p-6 text-left sm:p-8">
                      <p className="text-xs font-black tracking-[0.14em] text-ink-faint uppercase">O‘zbekcha tarjima</p>
                      <h2 className={cx('mt-2 text-3xl font-black', vocabularyTextClass(word.tone))}>{word.meaning}</h2>
                      <p className="mt-2 font-bold text-ink-faint">{word.transliteration}</p>
                      <div className="mt-5 rounded-2xl bg-ground-sunken p-4">
                        <p className="text-xs font-black tracking-[0.12em] text-ink-faint uppercase">Namunaviy gap</p>
                        <p className="mt-2 leading-relaxed text-ink">{word.example}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          speakRussian(word.phrase)
                        }}
                        className="mt-5 inline-flex items-center gap-3 rounded-full bg-signal px-5 py-3 font-extrabold text-on-signal"
                      >
                        <span className="flex size-7 items-center justify-center rounded-full bg-white/20"><PlayGlyph /></span>
                        Talaffuzni tinglash
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-hairline bg-ground/95 py-5 backdrop-blur sm:grid-cols-3">
              <Button size="lg" block className="sm:order-3" onClick={() => rate('known')}>Выучил →</Button>
              <Button size="lg" block variant="danger" className="sm:order-1" onClick={() => rate('unknown')}>← Не знаю</Button>
              <Button size="lg" block variant="secondary" className="col-span-2 sm:order-2 sm:col-span-1" onClick={() => rate('repeat')}>Повторю ↓</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

type VocabularyRating = 'known' | 'unknown' | 'repeat'

function vocabularyExitTransform(rating: VocabularyRating): string {
  if (rating === 'known') return 'translateX(110vw) rotateZ(12deg)'
  if (rating === 'unknown') return 'translateX(-110vw) rotateZ(-12deg)'
  return 'translateY(80vh) rotateZ(4deg)'
}

function VocabularyPhoto({ index, className }: { index: number; className?: string }) {
  const word = vocabulary[index]

  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff_0%,var(--color-signal-soft)_48%,var(--color-ground-sunken)_100%)] text-7xl',
        className,
      )}
    >
      {word.icon}
    </span>
  )
}

function vocabularyTextClass(tone: (typeof vocabulary)[number]['tone']): string {
  if (tone === 'red') return 'text-danger'
  if (tone === 'yellow') return 'text-[#f1b900]'
  if (tone === 'blue') return 'text-signal-ink'
  return 'text-ink'
}

function PictureExerciseSection() {
  const promptWords = ['сосед', 'квартира', 'дом', 'ключ', 'чай']

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-signal p-0">
        <div className="relative min-h-80 overflow-hidden bg-[linear-gradient(180deg,#dff2ff_0%,#fff7d8_55%,#d9efcf_55%)] p-6">
          <div className="absolute top-8 left-8 size-16 rounded-full bg-[#ffd34e] shadow-[0_0_0_18px_rgba(255,211,78,.2)]" />
          <div className="absolute top-8 right-10 text-5xl" aria-hidden="true">☁️</div>
          <div className="absolute right-[12%] bottom-0 h-56 w-52 rounded-t-[2.5rem] border-8 border-[#a9683d] bg-[#efbd77]">
            <div className="absolute inset-x-7 bottom-0 h-36 rounded-t-full bg-[#396aa7]" />
            <div className="absolute top-8 left-1/2 -translate-x-1/2 rounded-full bg-[#704729] px-4 py-1 text-xs font-black text-white">КВАРТИРА</div>
          </div>
          <div className="absolute bottom-5 left-[16%] flex items-end gap-2" aria-label="Eshik oldida kalit ushlab turgan kishi va uning qo‘shnisi">
            <span className="text-7xl" role="img" aria-label="Kalit ushlagan kishi">🧑‍🔧</span>
            <span className="mb-10 text-4xl" role="img" aria-label="Kalit">🔑</span>
            <span className="text-7xl" role="img" aria-label="Qo‘shni">🧑</span>
            <span className="mb-10 text-4xl" role="img" aria-label="Choy">🍵</span>
          </div>
        </div>
        <div className="bg-ground-raised p-6 sm:p-8">
          <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">Mashq</p>
          <h3 className="mt-2 text-2xl font-black text-ink">Rasmni rus tilida 3–4 gap bilan tasvirlang</h3>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Eshik oldidagi odamlar, kalit va choy taklifiga qarang. Quyidagi so‘zlardan foydalaning:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {promptWords.map((word) => (
              <span key={word} className="rounded-full bg-signal-soft px-3 py-1.5 font-black text-signal-ink">{word}</span>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-ground-sunken p-4">
            <p className="text-xs font-black tracking-[0.12em] text-ink-faint uppercase">Namuna</p>
            <p className="mt-2 leading-relaxed text-ink">
              «Это я и мой сосед. Я живу в этом доме. Это моя квартира. Я хочу пригласить соседа на чай.»
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function CompleteSection({ missionId, onReset }: { missionId?: string; onReset: () => void }) {
  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden border-milestone bg-milestone-soft/35 p-8 text-center sm:p-12">
        <AnswerCelebration />
        <div className="text-7xl" aria-hidden="true">🐧</div>
        <span className="mt-5 inline-flex rounded-full bg-milestone-soft px-4 py-2 text-sm font-black text-milestone">
          1-dars muvaffaqiyatli tugadi
        </span>
        <h3 className="mt-4 text-3xl font-black text-ink">Ajoyib!</h3>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
          Endi siz qo‘shningiz bilan tanisha olasiz, o‘zingizni tanishtira olasiz va rus tilida
          taklif qilishni bilasiz. Shunday davom eting — bu sizning ilk qadamingiz!
        </p>
        <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
          <Outcome icon="👋" title="Tanishuv" tone="yellow" body="Ismingizni ayta olasiz." />
          <Outcome icon="🏠" title="Uy va qo‘shni" tone="blue" body="Manzil haqida gapirasiz." />
          <Outcome icon="🍵" title="Taklif" tone="yellow" body="Choyga taklif qilasiz." />
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {missionId && <LinkButton to={`/missions/${missionId}`}>AI suhbatni mashq qilish</LinkButton>}
        <LinkButton to="/progress" variant="secondary">Progressni ko‘rish</LinkButton>
        <Button variant="ghost" size="lg" onClick={onReset}>Darsni qayta boshlash</Button>
      </div>
    </div>
  )
}

function QuizCard({
  number,
  character,
  question,
  answer,
  correct,
  options,
  feedback,
  onAnswer,
}: {
  number: string
  character: string
  question: string
  answer: string | null
  correct: string
  options: Array<[string, string, ('blue' | 'red' | 'yellow')?]>
  feedback: string
  onAnswer: (answer: string) => void
}) {
  const answeredCorrectly = answer === correct

  return (
    <Card className={cx('relative overflow-hidden p-6 sm:p-8', answeredCorrectly && 'border-milestone')}>
      {answeredCorrectly && <AnswerCelebration />}
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ground-sunken font-black text-ink-muted">{number}</span>
        <div>
          <p className="text-sm font-black text-signal-ink">{character}</p>
          <h3 className="mt-1 text-lg font-black leading-snug text-ink sm:text-xl">{question}</h3>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {options.map(([value, label, tone]) => {
          const selected = answer === value
          const isCorrectOption = value === correct
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (isCorrectOption && !answeredCorrectly) celebrateCorrectAnswer()
                onAnswer(value)
              }}
              className={cx(
                'flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition',
                selected
                  ? isCorrectOption
                    ? 'border-milestone bg-milestone-soft'
                    : 'border-danger bg-danger-soft'
                  : 'border-hairline bg-ground-raised hover:border-signal',
              )}
            >
              <span className="font-black uppercase text-ink">{value}</span>
              <span className={cx(
                'text-base font-black leading-relaxed',
                tone === 'blue'
                  ? 'text-signal-ink'
                  : tone === 'red'
                    ? 'text-danger'
                    : tone === 'yellow'
                      ? 'text-caution'
                      : 'text-ink',
              )}>
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {answer && (
        <div
          role="status"
          className={cx(
            'mt-5 rounded-2xl px-4 py-3 text-sm leading-relaxed',
            answeredCorrectly ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger',
          )}
        >
          <strong>{answeredCorrectly ? 'Верно! ' : 'Yana urinib ko‘ring. '}</strong>
          {answeredCorrectly && feedback}
        </div>
      )}
    </Card>
  )
}

const celebrationColors = ['#5b9bf5', '#ef4444', '#f4c84d', '#22c55e', '#a855f7']

function AnswerCelebration() {
  return createPortal(
    <span className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {Array.from({ length: 42 }, (_, index) => {
        const direction = index % 2 === 0 ? 1 : -1
        const style = {
          '--fall-x': `${3 + ((index * 37) % 94)}vw`,
          '--fall-drift': `${direction * (18 + (index % 5) * 9)}px`,
          '--fall-rotate': `${direction * (360 + index * 29)}deg`,
          '--fall-delay': `${(index % 14) * 45}ms`,
          '--fall-duration': `${2000 + (index % 8) * 125}ms`,
          '--fall-color': celebrationColors[index % celebrationColors.length],
        } as CSSProperties

        return (
          <span
            key={index}
            className={cx(
              'answer-celebration__piece',
              index % 3 === 0 ? 'answer-celebration__ball' : 'answer-celebration__ribbon',
            )}
            style={style}
          />
        )
      })}
    </span>,
    document.body,
  )
}

function celebrateCorrectAnswer() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate?.(35)
}

function Outcome({
  icon,
  title,
  body,
  tone,
}: {
  icon: string
  title: string
  body: string
  tone: 'yellow' | 'blue'
}) {
  return (
    <div className="rounded-2xl bg-ground-sunken p-4">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <h3 className={cx('mt-2 font-black', tone === 'yellow' ? 'text-[#f1b900]' : 'text-signal-ink')}>
        {title}
      </h3>
      <p className="mt-1 text-sm leading-snug text-ink-muted">{body}</p>
    </div>
  )
}

function LearnRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-16 font-bold text-ink-muted">{label}</dt>
      <dd className="font-black text-ink">{value}</dd>
    </div>
  )
}

function speakRussian(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ru-RU'
  utterance.rate = 0.84
  window.speechSynthesis.speak(utterance)
}

function loadState(storageKey: string | null): LessonState {
  if (!storageKey) return emptyState

  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return emptyState
    const candidate = JSON.parse(stored) as Partial<LessonState>
    return {
      ...emptyState,
      ...candidate,
      sectionIndex: Math.min(Math.max(candidate.sectionIndex ?? 0, 0), sections.length - 1),
      completed: Array.isArray(candidate.completed) ? candidate.completed : [],
      discoveredPhrases: Array.isArray(candidate.discoveredPhrases) ? candidate.discoveredPhrases : [],
      gameMatches: candidate.gameMatches ?? {},
    }
  } catch {
    return emptyState
  }
}

type SetLessonState = Dispatch<SetStateAction<LessonState>>
