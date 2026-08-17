import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { Button, Card, LinkButton, PlayGlyph, ProgressBar } from '../components/ui'
import { cx } from '../lib/cx'
import {
  LESSON_ONE_SECTIONS as sections,
  LESSON_ONE_STORAGE_KEY as storageKey,
} from '../lib/demo-lesson-one'
import type { LessonOneSection as LessonSection } from '../lib/demo-lesson-one'

type LessonState = {
  sectionIndex: number
  completed: LessonSection[]
  phoneticAnswer: string | null
  grammarAnswer: string | null
  discoveredPhrases: number[]
  gameMatches: Record<string, string>
}

type WalkPhrase = {
  ru: string
  transliteration: string
  character: '🐧' | '🐼' | '🪶'
  color: string
  place: string
}

const walkPhrases: WalkPhrase[] = [
  { ru: 'Доброе утро!', transliteration: 'Dobroye utro!', character: '🪶', color: 'Sariq', place: 'Kirishdagi tonggi lavha' },
  { ru: 'Добрый день!', transliteration: "Dobriy den'!", character: '🐧', color: 'Ko‘k', place: 'Favvora yonidagi sotuvchi' },
  { ru: 'Как тебя зовут?', transliteration: 'Kak tebya zovut?', character: '🐧', color: 'Ko‘k', place: 'Mehribon yo‘lovchi' },
  { ru: 'Меня зовут Анвар.', transliteration: 'Menya zovut Anvar.', character: '🐧', color: 'Ko‘k', place: 'O‘rindiqdagi sayyoh' },
  { ru: 'Как ваша фамилия?', transliteration: 'Kak vasha familiya?', character: '🐼', color: 'Qizil', place: 'Ko‘ngilli beydji' },
  { ru: 'Моя фамилия Каримов.', transliteration: 'Moya familiya Karimov.', character: '🐧', color: 'Ko‘k', place: 'Yangi tanishning daftari' },
  { ru: 'Очень приятно.', transliteration: "Ochen' priyatno.", character: '🐧', color: 'Ko‘k', place: 'Suhbatdoshning tabassumi' },
  { ru: 'Рад знакомству!', transliteration: 'Rad znakomstvu!', character: '🐧', color: 'Ko‘k', place: 'Qo‘l berib ko‘rishish' },
  { ru: 'Как зовут твоего отца?', transliteration: 'Kak zovut tvoyego ottsa?', character: '🐧', color: 'Ko‘k', place: 'Choyxonadagi katta do‘st' },
  { ru: 'Можно познакомиться?', transliteration: "Mozhno poznakomit'sya?", character: '🐧', color: 'Ko‘k', place: 'Yangi kelgan mehmon' },
  { ru: 'Давайте познакомимся!', transliteration: 'Davayte poznakomimsya!', character: '🐧', color: 'Ko‘k', place: 'Oqsoqol taklifi' },
  { ru: 'Я люблю пить горячий чай.', transliteration: "Ya lyublyu pit' goryachiy chay.", character: '🐧', color: 'Ko‘k', place: 'Choynak yonidagi suhbat' },
  { ru: 'Здесь очень сладкая самса.', transliteration: "Zdes' ochen' sladkaya samsa.", character: '🐼', color: 'Qizil', place: 'Tandir peshtoqidagi yozuv' },
  { ru: 'Спокойной ночи!', transliteration: 'Spokoynoy nochi!', character: '🐼', color: 'Qizil', place: 'Kechki chiroqlar' },
  { ru: 'До свидания, до завтра!', transliteration: 'Do svidaniya, do zavtra!', character: '🐧', color: 'Ko‘k', place: 'Choyxona darvozasi' },
]

const dialogue = [
  ['— Можно познакомиться? Меня зовут Али. А вас?', '— Приятно познакомиться! Моё имя Захро.'],
  ['— Рад знакомству. Можно на ты?', '— Да, конечно. Откуда ты?'],
  ['— Я из Узбекистана. А кто ты по национальности?', '— Я узбечка. Как твоя фамилия?'],
  ['— Моя фамилия Абдуллаев.', '— А как твоё отчество?'],
  ['— Моё отчество Алишерович.', '— Кто это?'],
  ['— Это мой друг.', '— Как его зовут?'],
  ['— Его зовут Ахмадбек. Можно просто Ахмад.', ''],
]

const aiQuestions = [
  'Давайте познакомимся! Как Вас зовут?',
  'Можно на ты?',
  'Как твоя фамилия?',
  'Как твоё отчество?',
  'Откуда ты?',
  'Кто ты по национальности?',
]

const vocabulary = [
  { phrase: 'мой друг', transliteration: 'moy drug', example: 'Этот человек — мой лучший друг.', icon: '🤝', tone: 'blue' },
  { phrase: 'моя мама', transliteration: 'moya mama', example: 'Моя мама готовит самый вкусный чай.', icon: '👩‍👧', tone: 'red' },
  { phrase: 'доброе утро', transliteration: 'dobroye utro', example: 'Утром мы говорим: «Доброе утро!»', icon: '🌄', tone: 'yellow' },
  { phrase: 'хорошая погода', transliteration: 'khoroshaya pogoda', example: 'Сегодня на улице очень хорошая погода.', icon: '☁️', tone: 'red' },
  { phrase: 'новое имя', transliteration: 'novoye imya', example: 'У него красивое и новое имя.', icon: '🏷️', tone: 'yellow' },
  { phrase: 'моя фамилия', transliteration: 'moya familiya', example: 'Назовите вашу фамилию, пожалуйста.', icon: '🪪', tone: 'red' },
  { phrase: 'горячий чай', transliteration: 'goryachiy chay', example: 'В чайхане нам подали горячий чай.', icon: '🍵', tone: 'blue' },
  { phrase: 'сладкая самса', transliteration: 'sladkaya samsa', example: 'На столе лежит аппетитная сладкая самса.', icon: '🥟', tone: 'red' },
  { phrase: 'большой город', transliteration: 'bolshoy gorod', example: 'Ташкент — это большой и красивый город.', icon: '🌆', tone: 'blue' },
  { phrase: 'родной дом', transliteration: 'rodnoy dom', example: 'Мой родной дом всегда полон гостей.', icon: '🏡', tone: 'blue' },
] as const

const greetings = ['Доброе утро!', 'Добрый день!', 'Спокойной ночи!']

const timeCards = [
  { id: 'morning', time: '08:00', label: 'Tong', answer: 'Доброе утро!', icon: '🌅' },
  { id: 'day', time: '14:00', label: 'Kunduz', answer: 'Добрый день!', icon: '☀️' },
  { id: 'night', time: '22:30', label: 'Tun', answer: 'Спокойной ночи!', icon: '🌙' },
]

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
  const [state, setState] = useState<LessonState>(loadState)
  const active = sections[state.sectionIndex] ?? sections[0]
  const completedCount = sections.filter((section) => state.completed.includes(section.id)).length

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state))
    window.dispatchEvent(new Event('rgg:lesson-one-progress'))
  }, [state])

  const gameSolved = useMemo(
    () => timeCards.every((card) => state.gameMatches[card.id] === card.answer),
    [state.gameMatches],
  )

  const canContinue =
    active.id === 'tests'
      ? state.phoneticAnswer === 'b' && state.grammarAnswer === 'c'
      : active.id === 'walk'
        ? state.discoveredPhrases.length === walkPhrases.length
        : active.id === 'game'
          ? gameSolved
          : true

  function visitSection(index: number) {
    setState((current) => ({
      ...current,
      sectionIndex: index,
      completed:
        sections[index]?.id === 'city' && !current.completed.includes('city')
          ? [...current.completed, 'city']
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
        ...(current.sectionIndex + 1 === sections.length - 1 ? ['city' as const] : []),
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
        <h1 className="sr-only">Birinchi dars progressi</h1>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm font-extrabold text-ink">Dars progressi</p>
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
        {(active.eyebrow || active.title) && (
          <div className="mb-5">
            {active.eyebrow && (
              <p className="text-xs font-black tracking-[0.16em] text-signal-ink uppercase">
                {active.eyebrow}
              </p>
            )}
            {active.title && (
              <h2 className={cx(
                'text-2xl font-black sm:text-3xl',
                active.id === 'welcome' ? 'text-caution' : 'text-ink',
                active.eyebrow && 'mt-1',
              )}>
                {active.title}
              </h2>
            )}
          </div>
        )}

        {active.id === 'welcome' && <WelcomeSection />}
        {active.id === 'tests' && <TestsSection state={state} setState={setState} />}
        {active.id === 'learn' && <LearnSection />}
        {active.id === 'walk' && <WalkSection state={state} setState={setState} />}
        {active.id === 'game' && <GameSection state={state} setState={setState} solved={gameSolved} />}
        {active.id === 'missions' && (
          <MissionsSection missionId={missionId} onStartMission={markMissionsComplete} />
        )}
        {active.id === 'vocabulary' && <VocabularySection />}
        {active.id === 'city' && <CitySection missionId={missionId} onReset={resetLesson} />}
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
                  : active.id === 'walk'
                    ? 'Choyxonadagi barcha 15 iborani toping.'
                    : 'Uchala vaqtni to‘g‘ri salomlashuv bilan moslang.'}
              </p>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

function WelcomeSection() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <p className="max-w-2xl text-lg leading-relaxed text-ink">
          Bugun siz Russian.gg shahridagi birinchi manzil — <strong>«Чайхана»</strong>ga kirasiz.
          Har bir topshiriq sizni tabiiy ruscha tanishuvga
          <img
            src="/lesson/uzbek-piyola.png"
            alt=""
            aria-hidden="true"
            className="ml-1 inline-block size-11 translate-y-1 object-contain align-middle sm:absolute sm:top-4 sm:right-5 sm:ml-0 sm:size-16 sm:translate-y-0"
          />{' '}
          yaqinlashtiradi.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Outcome icon="👋" title="Приветствие" tone="yellow" body="Vaqtga mos iborani tanlaysiz." />
          <Outcome icon="🗣️" title="знакомство" tone="yellow" body="Ism, familiya va kelib chiqishni aytasiz." />
          <Outcome icon="🏛️" title="городок" tone="blue" body="Choyxona obyektini ochasiz." />
        </div>
      </Card>

      <Card className="border-signal/25 bg-signal-soft">
        <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">Yo‘l xaritasi</p>
        <ol className="mt-4 space-y-3 text-sm">
          {['2 ta tezkor test', 'Rodlar va Аканье', '15 ta yashirin ibora', 'O‘yin', 'AI bilan suhbat', '10 ta yangi birikma'].map((item, index) => (
            <li key={item} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal font-black text-on-signal">
                {index + 1}
              </span>
              <span className="font-semibold text-ink">{item}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function TestsSection({ state, setState }: { state: LessonState; setState: SetLessonState }) {
  return (
    <div className="space-y-5">
      <QuizCard
        number="01"
        character="🪶 Перо"
        question='«Здравствуйте» so‘zini talaffuz qiling. Birinchi «в» tovushiga nima bo‘ladi?'
        answer={state.phoneticAnswer}
        correct="b"
        options={[
          ['a', 'Urg‘u birinchi bo‘g‘inga tushadi va «в» aniq aytiladi.'],
          ['b', 'Urg‘u birinchi bo‘g‘inga tushadi va «в» talaffuzda tushib qoladi.'],
          ['c', 'Urg‘u ikkinchi bo‘g‘inga tushadi va barcha harflar aniq aytiladi.'],
        ]}
        feedback="Qadrdonim, uzun so‘zni ko‘rgan birinchi «В» hushidan ketgan 😉 — u talaffuz qilinmaydi. Urg‘u birinchi bo‘g‘inga tushadi: здра́вствуйте."
        onAnswer={(answer) => setState((current) => ({ ...current, phoneticAnswer: answer }))}
      />

      <QuizCard
        number="02"
        character="🐧 Пингвин"
        question='Jumlani tugating: «Добр... утро!»'
        answer={state.grammarAnswer}
        correct="c"
        options={[
          ['a', 'Добрый', 'blue'],
          ['b', 'Добрая', 'red'],
          ['c', 'Доброе', 'yellow'],
        ]}
        feedback="Barakalla! «Утро» — средний род, shuning uchun sifatning qo‘shimchasi «-ое»: доброе утро."
        onAnswer={(answer) => setState((current) => ({ ...current, grammarAnswer: answer }))}
      />
    </div>
  )
}

function LearnSection() {
  const genders = [
    {
      character: '🐧',
      title: 'Мужской род',
      color: 'Ko‘k qirollik',
      endings: 'undosh, -й, -ь',
      examples: 'друг, день, папа',
      anchor: 'он мой',
      className: 'border-signal bg-signal-soft',
      accentClass: 'text-[#084fbd]',
    },
    {
      character: '🐼',
      title: 'Женский род',
      color: 'Qizil qirollik',
      endings: '-а, -я, -ь',
      examples: 'мама, земля, ночь',
      anchor: 'она моя',
      className: 'border-danger bg-danger-soft',
      accentClass: 'text-[#e0001b]',
    },
    {
      character: '🪶',
      title: 'Средний род',
      color: 'Sariq qirollik',
      endings: '-о, -е, -мя',
      examples: 'утро, имя, здание',
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
              Undosh harf va <strong>-ь</strong> bilan tugagan so‘zlarni o‘z ichiga tanlab olibdi
              (misol uchun, <strong>друг, день, папа</strong>). Ular faxr bilan:
              <strong className="text-[#084fbd]"> “он мой”</strong> deyishadi.
            </p>
          </article>

          <article className="rounded-2xl border-2 border-danger bg-danger-soft p-5">
            <p className="font-black text-[#e0001b]">🐼 Panda qirolligi · Женский род</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              <strong>-а, -я, -ь</strong> harflari bilan tugagan so‘zlarni o‘z hududiga kirgizibdi
              (masalan, <strong>мама, земля, фамилия</strong>). Ular ohista shivirlashadi:
              <strong className="text-[#e0001b]"> “она моя”</strong>.
            </p>
          </article>

          <article className="rounded-2xl border-2 border-caution bg-caution-soft p-5">
            <p className="font-black text-[#c88b00]">🪶 Pat qirolligi · Средний род</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Jonsiz narsalardan aynan <strong>-о, -е, -ё</strong> harflari bilan tugaganlarini
              saralab olibdi (masalan, <strong>утро, имя, здание</strong>). Ular ishonch bilan:
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

      <Card className="overflow-hidden border-signal p-0">
        <div className="grid md:grid-cols-[.7fr_1.3fr]">
          <div className="flex min-h-48 items-center justify-center bg-signal-soft p-8">
            <div className="text-center">
              <div className="text-6xl" aria-hidden="true">🐼</div>
              <p className="mt-3 font-black text-signal-ink">Talaffuz murabbiyi</p>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-black tracking-[0.15em] text-signal-ink uppercase">Аканье qoidasi</p>
            <h3 className="mt-2 text-2xl font-black text-ink">Urg‘usiz «О» → «А»</h3>
            <p className="mt-3 leading-relaxed text-ink-muted">
              «О» harfiga urg‘u tushmasa, u talaffuzda «А»ga yaqin eshitiladi. Yozilishi o‘zgarmaydi,
              faqat aytilishi o‘zgaradi.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {[
                ['откуда', '[atkuda]'],
                ['утро', '[utra]'],
                ['твоя', '[tvaya]'],
              ].map(([word, sound]) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => speakRussian(word)}
                  className="flex items-center gap-3 rounded-2xl border-2 border-hairline bg-ground-raised px-4 py-3 text-left transition hover:border-signal"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-signal text-on-signal"><PlayGlyph /></span>
                  <span><strong className="block text-ink">{word}</strong><span className="text-sm text-ink-muted">{sound}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function WalkSection({ state, setState }: { state: LessonState; setState: SetLessonState }) {
  function discover(index: number) {
    setState((current) => ({
      ...current,
      discoveredPhrases: current.discoveredPhrases.includes(index)
        ? current.discoveredPhrases
        : [...current.discoveredPhrases, index],
    }))
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-caution bg-[linear-gradient(180deg,#fff7da,var(--color-ground-raised))] p-0">
        <div className="relative min-h-64 overflow-hidden px-6 pt-8 text-center">
          <div className="absolute top-5 left-8 size-14 rounded-full bg-[#f8c84b] shadow-[0_0_0_14px_rgba(248,200,75,.15)]" />
          <div className="absolute right-8 bottom-5 text-7xl opacity-80" aria-hidden="true">🌳</div>
          <div className="relative mx-auto mt-9 max-w-xl rounded-t-[64px] border-8 border-b-0 border-[#9a5f36] bg-[#f2c382] px-5 pt-8 pb-4 shadow-soft">
            <div className="mx-auto w-fit rounded-full bg-[#57371f] px-5 py-2 text-sm font-black tracking-widest text-white uppercase">Чайхана</div>
            <div className="mt-7 flex justify-center gap-4">
              <span className="h-24 w-16 rounded-t-full bg-[#5b9bf5]/70" />
              <span className="h-24 w-16 rounded-t-full bg-[#c8342a]/65" />
              <span className="h-24 w-16 rounded-t-full bg-[#5b9bf5]/70" />
            </div>
          </div>
        </div>
        <div className="border-t-2 border-caution bg-ground-raised px-5 py-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-ink">15 ta iborani toping</p>
            <p className="text-sm text-ink-muted">Har bir joyni bosing, iborani tinglang va qaytaring.</p>
          </div>
          <p className="mt-2 text-lg font-black text-caution sm:mt-0">{state.discoveredPhrases.length} / 15</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {walkPhrases.map((phrase, index) => {
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
              <p className="mt-3 text-xs font-bold tracking-wide text-ink-muted uppercase">{phrase.place}</p>
              {discovered ? (
                <>
                  <p className="mt-2 text-lg font-black leading-snug text-ink">{phrase.ru}</p>
                  <p className="mt-1 text-sm text-ink-muted">{phrase.transliteration}</p>
                  <button
                    type="button"
                    onClick={() => speakRussian(phrase.ru)}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-black text-signal-ink"
                  >
                    <PlayGlyph /> Tinglash · {phrase.color}
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
  function match(cardId: string, greeting: string, correctAnswer: string) {
    if (greeting === correctAnswer && state.gameMatches[cardId] !== correctAnswer) {
      celebrateCorrectAnswer()
    }
    setState((current) => ({
      ...current,
      gameMatches: { ...current.gameMatches, [cardId]: greeting },
    }))
  }

  return (
    <div className="space-y-5">
      <Card className="bg-ink text-ground-raised">
        <p className="text-xs font-black tracking-[0.15em] text-signal uppercase">O‘yin qoidasi</p>
        <p className="mt-2 max-w-3xl text-lg leading-relaxed">
          Har bir soat uchun mos salomlashuvni tanlang. Uchala javob to‘g‘ri bo‘lsa, yo‘l ochiladi.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {timeCards.map((card) => {
          const selected = state.gameMatches[card.id]
          const correct = selected === card.answer
          return (
            <Card key={card.id} className={cx('relative overflow-hidden', correct && 'border-milestone bg-milestone-soft')}>
              {correct && <AnswerCelebration />}
              <div className="text-center">
                <span className="text-5xl" aria-hidden="true">{card.icon}</span>
                <p className="mt-3 text-3xl font-black tabular-nums text-ink">{card.time}</p>
                <p className="text-sm font-bold text-ink-muted">{card.label}</p>
              </div>
              <div className="mt-5 space-y-2">
                {greetings.map((greeting) => (
                  <button
                    key={greeting}
                    type="button"
                    onClick={() => match(card.id, greeting, card.answer)}
                    className={cx(
                      'w-full rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition',
                      selected === greeting
                        ? correct
                          ? 'border-milestone bg-ground-raised text-milestone'
                          : 'border-danger bg-danger-soft text-danger'
                        : 'border-hairline bg-ground-raised text-ink hover:border-signal',
                    )}
                  >
                    {greeting}
                  </button>
                ))}
              </div>
              {selected && (
                <p className={cx('mt-3 text-center text-sm font-bold', correct ? 'text-milestone' : 'text-danger')}>
                  {correct ? 'To‘g‘ri!' : 'Vaqtga yana bir qarang.'}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {solved && (
        <div role="status" className="rounded-2xl bg-milestone-soft px-5 py-4 text-center font-black text-milestone">
          ✓ Ajoyib! Salomlashuvlar vaqt bilan to‘g‘ri moslandi.
        </div>
      )}
    </div>
  )
}

function MissionsSection({ missionId, onStartMission }: { missionId?: string; onStartMission: () => void }) {
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
            {aiQuestions.map((question, index) => (
              <li key={question} className="flex gap-3 text-sm leading-snug text-ink">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-signal-soft text-xs font-black text-signal-ink">{index + 1}</span>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="border-signal bg-signal-soft text-center">
          <div className="text-5xl" aria-hidden="true">🎙️</div>
          <h3 className="mt-3 text-xl font-black text-ink">Gapirishga tayyormisiz?</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            AI savol beradi, siz ruscha javob berasiz. Talaffuz va grammatika bo‘yicha darhol fikr olasiz.
          </p>
          {missionId ? (
            <LinkButton to={`/missions/${missionId}`} block className="mt-5" onClick={onStartMission}>
              AI missiyani boshlash
            </LinkButton>
          ) : (
            <p className="mt-5 text-sm font-bold text-danger">Missiya identifikatori topilmadi.</p>
          )}
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
    speakRussian(vocabulary[index].phrase)
  }

  function showNextWord() {
    setActiveIndex((current) => {
      if (current === null || current >= vocabulary.length - 1) return null
      const next = current + 1
      speakRussian(vocabulary[next].phrase)
      return next
    })
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {vocabulary.map((word, index) => (
          <button
            key={word.phrase}
            type="button"
            onClick={() => openWord(index)}
            className="group flex items-start gap-4 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-4 text-left transition hover:-translate-y-0.5 hover:border-signal"
          >
            <span className={cx(
              'flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl',
              word.tone === 'blue' ? 'bg-signal-soft' : word.tone === 'red' ? 'bg-danger-soft' : 'bg-caution-soft',
            )} aria-hidden="true">{word.icon}</span>
            <span className="min-w-0 flex-1">
              <span className={cx('flex items-center gap-2 text-lg font-black', vocabularyTextClass(word.tone))}>
                {word.phrase}
                <span className="text-signal-ink opacity-60 transition group-hover:opacity-100"><PlayGlyph /></span>
              </span>
              <span className="block text-xs font-bold text-ink-faint">{word.transliteration}</span>
              <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{word.example}</span>
            </span>
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <VocabularyStudy
          word={vocabulary[activeIndex]}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onNext={showNextWord}
        />
      )}
    </div>
  )
}

function VocabularyStudy({
  word,
  index,
  onClose,
  onNext,
}: {
  word: (typeof vocabulary)[number]
  index: number
  onClose: () => void
  onNext: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-ground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vocabulary-word"
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-extrabold text-ink-muted">
            {index + 1} / {vocabulary.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex size-11 items-center justify-center rounded-full border-2 border-hairline bg-ground-raised text-2xl font-bold text-ink hover:border-ink-faint"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center py-8 text-center">
          <div className={cx(
            'mx-auto flex size-52 items-center justify-center rounded-[2.5rem] sm:size-64',
            vocabularySurfaceClass(word.tone),
          )}>
            <span className="text-8xl sm:text-9xl" aria-hidden="true">{word.icon}</span>
          </div>
          <h2
            id="vocabulary-word"
            className={cx('mt-7 text-4xl font-black sm:text-5xl', vocabularyTextClass(word.tone))}
          >
            {word.phrase}
          </h2>
          <p className="mt-2 text-base font-bold text-ink-faint">{word.transliteration}</p>

          <button
            type="button"
            onClick={() => speakRussian(word.phrase)}
            className="mx-auto mt-6 inline-flex items-center gap-3 rounded-full bg-signal px-6 py-3 font-extrabold text-on-signal shadow-[0_4px_0_0_var(--color-signal-depth)] active:translate-y-1 active:shadow-none"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
              <PlayGlyph />
            </span>
            Talaffuzni tinglash
          </button>

          <Card className="mx-auto mt-7 w-full max-w-xl text-left">
            <p className="text-xs font-black tracking-[0.14em] text-ink-faint uppercase">Namunaviy gap</p>
            <p className="mt-2 text-lg leading-relaxed text-ink">{word.example}</p>
          </Card>
        </div>

        <div className="sticky bottom-0 grid gap-3 border-t border-hairline bg-ground/95 py-5 backdrop-blur sm:grid-cols-3">
          <Button size="lg" block onClick={onNext}>Выучил</Button>
          <Button size="lg" block variant="secondary" onClick={onNext}>Не знаю</Button>
          <Button size="lg" block variant="secondary" onClick={onNext}>Повторю</Button>
        </div>
      </div>
    </div>
  )
}

function vocabularyTextClass(tone: (typeof vocabulary)[number]['tone']): string {
  if (tone === 'red') return 'text-danger'
  if (tone === 'yellow') return 'text-caution'
  return 'text-signal-ink'
}

function vocabularySurfaceClass(tone: (typeof vocabulary)[number]['tone']): string {
  if (tone === 'red') return 'bg-danger-soft'
  if (tone === 'yellow') return 'bg-caution-soft'
  return 'bg-signal-soft'
}

function CitySection({ missionId, onReset }: { missionId?: string; onReset: () => void }) {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-milestone p-0">
        <div className="relative min-h-72 overflow-hidden bg-[linear-gradient(180deg,#dff2ff_0%,#fff3c9_58%,#d7edcf_58%)] px-5 pt-8 text-center">
          <div className="absolute top-7 left-10 size-16 rounded-full bg-[#ffd34e] shadow-[0_0_0_18px_rgba(255,211,78,.2)]" />
          <div className="absolute top-8 right-8 text-5xl" aria-hidden="true">☁️</div>
          <div className="relative mx-auto mt-12 max-w-md">
            <div className="mx-auto w-fit rounded-full border-4 border-[#5b3823] bg-[#704729] px-6 py-2 text-sm font-black tracking-widest text-white">ЧАЙХАНА</div>
            <div className="mx-auto -mt-1 grid max-w-sm grid-cols-3 gap-4 rounded-t-[70px] border-8 border-b-0 border-[#a9683d] bg-[#efbd77] px-8 pt-12">
              {[0, 1, 2].map((door) => <span key={door} className="h-28 rounded-t-full bg-[#396aa7] shadow-inner" />)}
            </div>
          </div>
        </div>
        <div className="bg-ground-raised p-6 text-center sm:p-8">
          <span className="inline-flex rounded-full bg-milestone-soft px-4 py-2 text-sm font-black text-milestone">Yangi obyekt ochildi</span>
          <h3 className="mt-4 text-3xl font-black text-ink">«Чайхана»</h3>
          <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-ink-muted">
            Bu bino muloqotning boshlanishi, mehmondo‘stlik va yangi do‘stlarga olib boradigan ko‘prikni anglatadi.
            Bilimingiz oshgani sayin Russian.gg shahri ham o‘sadi.
          </p>
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
          <strong>{answeredCorrectly ? 'To‘g‘ri! ' : 'Yana urinib ko‘ring. '}</strong>
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
      {Array.from({ length: 30 }, (_, index) => {
        const direction = index % 2 === 0 ? 1 : -1
        const style = {
          '--fall-x': `${3 + ((index * 37) % 94)}vw`,
          '--fall-drift': `${direction * (18 + (index % 5) * 9)}px`,
          '--fall-rotate': `${direction * (360 + index * 29)}deg`,
          '--fall-delay': `${(index % 10) * 55}ms`,
          '--fall-duration': `${1050 + (index % 6) * 95}ms`,
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
      <h3 className={cx('mt-2 font-black', tone === 'yellow' ? 'text-caution' : 'text-signal-ink')}>
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

function loadState(): LessonState {
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
