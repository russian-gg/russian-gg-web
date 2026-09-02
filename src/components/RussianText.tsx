import { createContext, useContext, type ReactNode } from 'react'

export const RUSSIAN_COLOR_SYSTEM = {
  gender: { masculine: '#0000FF', feminine: '#FF2400', neuter: '#FFFF00' },
  cases: {
    genitive: '#8B00FF', dative: '#964B00', accusative: '#00BFFF',
    instrumental: '#44944A', prepositional: '#480607',
  },
  verbs: { personalEnding: '#ED3CCA', pastSuffixAndEnding: '#F984E5' },
} as const

type Gender = keyof typeof RUSSIAN_COLOR_SYSTEM.gender
type CaseName = keyof typeof RUSSIAN_COLOR_SYSTEM.cases

/**
 * A colour only means something to a learner who has been taught what it marks, so each lesson
 * paints only the layers its course has reached. The lesson docs spell this out phrase by phrase:
 * day 1 gives «этаж (#0000FF) + е» — the gender root coloured, the case ending plain — and
 * «Меня зовут Али» as «(без цвета)», while day 9 finally marks «дене|г» in genitive purple.
 * Painting everything the matcher can recognise put case endings and verb endings on the screen
 * lessons before either was introduced.
 *
 * Layers open in the order the 15-day course teaches them (`grammar_focus` in docs/lessons):
 *   day 1  род существительных            → gender roots (nouns, adjectives, possessives)
 *   day 4  окончания глаголов 1 спряжения → present-tense personal endings
 *   day 9  «у меня нет» + родительный      → genitive endings
 *   day 11 винительный падеж               → accusative endings
 *   day 13 предложный падеж                → prepositional endings
 *   day 14 (dative/instrumental appear in its vocabulary table: «другу», «с собой»)
 * Past-tense «-л-» is never taught inside these fifteen days, so it stays black in lessons.
 */
export type ColorScope = {
  verbPersonalEndings: boolean
  pastTense: boolean
  cases: ReadonlySet<CaseName>
}

const ALL_CASES: ReadonlySet<CaseName> = new Set(['genitive', 'dative', 'accusative', 'instrumental', 'prepositional'])

/** Outside a lesson there is no syllabus to respect, so every layer is on. */
const FULL_SCOPE: ColorScope = { verbPersonalEndings: true, pastTense: true, cases: ALL_CASES }

const CASE_UNLOCK_DAY: Record<CaseName, number> = {
  genitive: 9,
  accusative: 11,
  prepositional: 13,
  dative: 14,
  instrumental: 14,
}

export function colorScopeForDay(day: number): ColorScope {
  return {
    verbPersonalEndings: day >= 4,
    pastTense: false,
    cases: new Set((Object.keys(CASE_UNLOCK_DAY) as CaseName[]).filter((name) => day >= CASE_UNLOCK_DAY[name])),
  }
}

const ColorScopeContext = createContext<ColorScope>(FULL_SCOPE)

export function ColorScopeProvider({ day, children }: { day: number; children: ReactNode }) {
  return <ColorScopeContext value={colorScopeForDay(day)}>{children}</ColorScopeContext>
}

const nounStems: Array<{ stem: string; gender: Gender }> = [
  ...'учебник,зарядник,интернет,кошелёк,кошелек,документ,проездн,наушник,бензин,магазин,фонтан,вокзал,театр,город,музей,учител,инженер,студент,рабоч,начальник,директор,телефон,звонок,сосед,ключ,этаж,офис,друг,друз,люд,дет,голос,вопрос,ответ,язык,текст,диалог,фильм,хлеб,диван,телевизор,порт,стол,муж,дом,пап,врач,номер,чай,парк,мёд,мяч,мир,мост,брат,дедушк,дяд,отец,человек,ребёнок,ребенок,родител,сын,мальчик,зонт,свет,шум,день,стул,сыр,лист,коллег,университет,завод,топор,футбол,нос,ноль,гост,шкаф,компьютер,ковёр,паспорт,билет,выход,пример,урок,диктант,стих,вечер,центр,карман,смысл,шанс,рубл,угол'.split(',').map((stem) => ({ stem, gender: 'masculine' as const })),
  ...'зарядк,деньг,иде,ручк,тетрад,улиц,площад,рек,ед,професси,квартир,лестниц,комнат,зарплат,больниц,компани,грамматик,музык,стать,гитар,ошибк,дорог,работ,школ,книг,газет,правд,фраз,двер,мам,семь,сестр,бабушк,тёт,тет,девушк,доч,жен,женщин,земл,фамил,рам,мук,нян,кроват,ламп,одежд,картин,машин,вод,дене,подруг,звезд,заметк,библиотек,сумк,полк,помощ,сил,надежд'.split(',').map((stem) => ({ stem, gender: 'feminine' as const })),
  ...'удовольстви,упражнен,письм,радио,мюсл,здан,детств,событ,кафе,метр,окн,мор,слов,мыл,семейств,врем,им,утр,правил,зеркал,счасть,терпен'.split(',').map((stem) => ({ stem, gender: 'neuter' as const })),
].sort((a, b) => b.stem.length - a.stem.length)

const personalEndingOverrides: Record<string, string> = {
  'живёте': 'ёте', 'живу': 'у',
  // "работаю" collides with the noun "работа" (findNoun claims it first), so the я-form needs
  // its own override — "работаешь"/"работает"/etc. already work via presentTenseLongEndings.
  'работаю': 'аю',
  // "спать" is irregular (спл- appears only in conjugation, not the infinitive), so it never
  // matches a verbStems prefix and falls through the regular present-tense detection.
  'сплю': 'ю', 'спишь': 'ишь', 'спит': 'ит', 'спим': 'им', 'спите': 'ите', 'спят': 'ят',
}
const pastTenseWordOverrides: Record<string, string> = { 'мыла': 'ла' }
const verbStems = ['работ', 'говор', 'чит', 'понима', 'слыш', 'жив', 'зов', 'хоч', 'дела', 'приглас', 'люб', 'вид', 'зна', 'помн', 'встреч', 'уч', 'игра', 'смотр', 'слуш', 'повтор', 'отвеч', 'пиш', 'звон', 'перезвон', 'дума', 'отдых', 'гуля', 'объясня', 'исправля', 'помога', 'заним', 'счита', 'готов', 'виж']
// Present-tense personal endings. The longer ones (≥2 letters: -ешь/-ете/-ют…) are distinctive
// enough to check before nounStems — no Russian case ending looks like them. The bare я-form
// -ю/-у is not: it collides with noun accusative endings (работу = "the work", not a verb), so
// it's only tried once nounStems has already had first refusal (see colorRussianWord).
const presentTenseLongEndings = ['ешь', 'ишь', 'ете', 'ите', 'ют', 'ут', 'ят', 'ат', 'ет', 'ит', 'ем', 'им']
const presentTenseShortEndings = ['ю', 'у']
// The mascots are characters, not vocabulary. A name has no grammatical gender to teach, and
// colouring "Панда" red made her read like a feminine-noun example inside the dialogues. Her
// case forms are listed too, so "у Панды" / "к Панде" stay black as well.
const blackWords = new Set([
  'а', 'и', 'немного', 'русский', 'каждый',
  'панда', 'панды', 'панде', 'панду', 'пандой',
  // People's names carry no grammar to teach, and several of them look exactly like something the
  // matcher knows: "Мила" ends like a past-tense verb ("мыла"), "Соней"/"Таней" like instrumentals.
  // They appear in tongue twisters and example sentences, so they are named here explicitly.
  'мила', 'милу', 'миле', 'потап', 'потапа', 'али', 'акмал', 'акмала', 'аня', 'аню', 'ане',
  'соня', 'соней', 'сеня', 'таня', 'тане', 'таню', 'дёма', 'дема', 'дёмы', 'демы',
])
const fullGenderWords: Record<string, Gender> = {
  'мужской': 'masculine',
  'синий': 'masculine',
  'женский': 'feminine',
  'красный': 'feminine',
  'средний': 'neuter',
  'жёлтый': 'neuter',
  // Possessives carry the gender of the noun they agree with, so they take its colour —
  // the lesson documents spell this out ("моя + мама" both red, "твой + папа" both blue).
  // "чей/чья/чьё" is the question those answer, and it agrees the same way, so the drill reads
  // as one coloured pair: Чья? → моя, both red.
  // Only the nominative forms are listed. In an oblique form the gender marker is gone — the
  // ending shows the case instead ("своя" → "свою", accusative) — so there is no gender left in
  // the word to colour, and it stays black until its case is part of the course.
  // The plural forms (мои, твои, чьи…) stay uncoloured too: they span all three genders.
  ...Object.fromEntries(['мой', 'твой', 'наш', 'ваш', 'свой', 'чей'].map((word) => [word, 'masculine' as const])),
  ...Object.fromEntries(['моя', 'твоя', 'наша', 'ваша', 'своя', 'чья'].map((word) => [word, 'feminine' as const])),
  ...Object.fromEntries(
    ['моё', 'мое', 'твоё', 'твое', 'наше', 'ваше', 'своё', 'свое', 'чьё', 'чье'].map((word) => [word, 'neuter' as const]),
  ),
}

// Adjectives with a *stressed* -ой ending in the masculine nominative (какой, молодой, большой…)
// are spelled identically to the feminine instrumental -ой ending of any other adjective
// (красивой, доброй…). Both are real, common forms, and bare suffix-matching can't tell them
// apart — adjectiveEndings' feminine-instrumental 'ой' entry would otherwise win by array order
// and split "какой"/"молодой" into a red root + green case-ending. This is a closed class in
// Russian, so — like personalEndingOverrides/pastTenseWordOverrides — the ambiguous words are
// listed explicitly and checked first, rather than trying to reorder the general suffix table.
const masculineOyWords = new Set(['какой', 'такой', 'никакой', 'другой', 'большой', 'молодой', 'родной', 'дорогой', 'плохой'])

const adjectiveEndings: Array<{ ending: string; gender: Gender | null; caseName?: CaseName }> = [
  { ending: 'ыми', gender: null, caseName: 'instrumental' }, { ending: 'ими', gender: null, caseName: 'instrumental' },
  { ending: 'ого', gender: 'masculine', caseName: 'genitive' }, { ending: 'его', gender: 'masculine', caseName: 'genitive' },
  { ending: 'ому', gender: 'masculine', caseName: 'dative' }, { ending: 'ему', gender: 'masculine', caseName: 'dative' },
  { ending: 'ую', gender: 'feminine', caseName: 'accusative' }, { ending: 'юю', gender: 'feminine', caseName: 'accusative' },
  { ending: 'ой', gender: 'feminine', caseName: 'instrumental' }, { ending: 'ей', gender: 'feminine', caseName: 'instrumental' },
  { ending: 'ым', gender: 'masculine', caseName: 'instrumental' }, { ending: 'им', gender: 'masculine', caseName: 'instrumental' },
  { ending: 'ом', gender: 'masculine', caseName: 'prepositional' }, { ending: 'ем', gender: 'masculine', caseName: 'prepositional' },
  { ending: 'ая', gender: 'feminine' }, { ending: 'яя', gender: 'feminine' }, { ending: 'ое', gender: 'neuter' },
  { ending: 'ее', gender: 'neuter' }, { ending: 'ый', gender: 'masculine' }, { ending: 'ий', gender: 'masculine' },
  { ending: 'ой', gender: 'masculine' }, { ending: 'ые', gender: null }, { ending: 'ие', gender: null },
]

export function RussianText({ text, phoneticVowels = false }: { text: string; phoneticVowels?: boolean }) {
  const scope = useContext(ColorScopeContext)
  const pieces = text.split(/([\p{Script=Cyrillic}][\p{Script=Cyrillic}\p{M}]*)/gu)
  const singleVowel = /^[АОУ]$/u.test(text.trim())
  let previousWord = ''
  let previousPreviousWord = ''

  return <>{pieces.map((piece, index) => {
    if (!/[А-Яа-яЁё]/u.test(piece)) return <span key={index}>{piece}</span>
    const lower = normalizeWord(piece)
    const rendered = singleVowel || (phoneticVowels && /^[аоу]$/u.test(lower))
      ? <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender.feminine)}>{piece}</span>
      : colorRussianWord(piece, lower, previousWord, previousPreviousWord, scope)
    previousPreviousWord = previousWord
    previousWord = lower
    return <span key={index}>{rendered}</span>
  })}</>
}

function normalizeWord(word: string) {
  return word.toLocaleLowerCase('ru-RU').replace(/[̀́]/gu, '')
}

function colorRussianWord(original: string, lower: string, previousWord: string, previousPreviousWord: string, scope: ColorScope): ReactNode {
  if (blackWords.has(lower)) return original
  // The preposition is coloured as a hint about the case it governs, so it only makes sense once
  // that case is part of the course.
  if ((lower === 'с' || lower === 'со') && scope.cases.has('instrumental')) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases.instrumental)}>{original}</span>
  if (lower === 'на' && scope.cases.has('prepositional')) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases.prepositional)}>{original}</span>

  const fullGender = fullGenderWords[lower]
  if (fullGender) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[fullGender])}>{original}</span>
  if (lower === 'род' && fullGenderWords[previousWord]) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[fullGenderWords[previousWord]])}>{original}</span>

  if (masculineOyWords.has(lower)) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender.masculine)}>{original}</span>

  // A verb is recognised whatever the scope, and only the paint waits for the syllabus: dropping
  // out of these branches early would hand the word to the noun matcher instead, and "работаю"
  // would come back red as the noun "работа" — worse than the black it is supposed to be.
  const explicitEnding = personalEndingOverrides[lower]
  if (explicitEnding) {
    if (!scope.verbPersonalEndings) return original
    return <><span>{original.slice(0, -explicitEnding.length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.personalEnding)}>{original.slice(-explicitEnding.length)}</span></>
  }

  const pastTenseOverride = pastTenseWordOverrides[lower]
  if (pastTenseOverride) {
    if (!scope.pastTense) return original
    return <><span>{original.slice(0, -pastTenseOverride.length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-pastTenseOverride.length)}</span></>
  }

  const knownPast = lower.match(/л[аои]?$/u)
  if (knownPast && (verbStems.some((stem) => lower.startsWith(stem)) || lower.startsWith('бы'))) {
    if (!scope.pastTense) return original
    return <><span>{original.slice(0, -knownPast[0].length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-knownPast[0].length)}</span></>
  }

  const longPresentEnding = findVerbEnding(lower, presentTenseLongEndings)
  if (longPresentEnding) return scope.verbPersonalEndings ? renderVerbEnding(original, longPresentEnding) : original

  // An infinitive has no personal ending to mark, so it stays black — but the check has to come
  // before the noun matcher, because a verb stem often opens a noun too: "работать" begins with
  // the noun stem "работ" and was coming back red as "работа".
  // A few feminine nouns also end in -ть/-чь/-ти (кровать, дочь, гости, дети). There the stem
  // covers everything but a one- or two-letter case ending, while an infinitive leaves its whole
  // suffix behind ("работ" + "ать") — that gap is what tells the two apart.
  if (isInfinitive(lower)) return original

  const noun = findNoun(lower)
  if (noun) {
    // Bare -ы/-и (студенты), the substantivised-adjective plural -ие/-ые (рабочие), and the
    // irregular -ья plural (друзья, братья) are all unambiguous masculine plural markers — no
    // singular case of these nouns ends that way. Russian plurals don't carry gender at all
    // (unlike the singular forms this whole system teaches), so colouring one by its dictionary
    // gender would teach the wrong lesson; leave it uncoloured, like plural possessives already are.
    const rawEnding = lower.slice(noun.stem.length)
    if (noun.gender === 'masculine' && ['ы', 'и', 'ые', 'ие', 'ья'].includes(rawEnding)) return original

    // A case-marked adjective in front carries the case of the whole phrase, so the noun it
    // modifies takes the same ending colour: "моего брата" is one genitive pair, and colouring
    // only the adjective's ending left the noun looking like a bare nominative.
    const caseName = inferCase(previousWord, previousPreviousWord, lower) ?? adjectiveCase(previousWord)
    // Before the course reaches this case the whole word simply carries its gender, exactly as the
    // lesson docs print it: day 1 shows «квартир (#FF2400) + а», not a two-colour split.
    if (!caseName || !scope.cases.has(caseName)) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[noun.gender])}>{original}</span>
    const root = original.slice(0, noun.stem.length)
    const ending = original.slice(noun.stem.length)
    return <><span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[noun.gender])}>{root}</span>{ending && <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases[caseName])}>{ending}</span>}</>
  }

  const shortPresentEnding = findVerbEnding(lower, presentTenseShortEndings)
  if (shortPresentEnding) return scope.verbPersonalEndings ? renderVerbEnding(original, shortPresentEnding) : original

  const adjective = adjectiveEndings.find(({ ending }) => lower.endsWith(ending) && lower.length > ending.length + 1)
  if (adjective) {
    // Every gendered ending in adjectiveEndings already encodes its own gender correctly — the
    // only entries with gender: null are -ые/-ие/-ыми/-ими, and those are exclusively plural in
    // Russian. Plurals span all three genders (see the noun-plural check above and the plural
    // possessives left uncoloured), so there is no single colour to borrow for them; guessing one
    // from the next word's dictionary gender was wrong whenever that next word was itself plural
    // (e.g. "большие столы" is not masculine — "столы" is plural too).
    if (!adjective.gender) return original
    const genderColor = RUSSIAN_COLOR_SYSTEM.gender[adjective.gender]
    if (!adjective.caseName) return <span style={styleFor(genderColor)}>{original}</span>
    // Several adjective endings are shared between cases ("-ой" alone could be four of them), so
    // where the context names a case it wins over the suffix table's default — otherwise the
    // adjective and the noun after it end up flagged as two different cases in one phrase.
    const caseName = inferCase(previousWord, previousPreviousWord, lower) ?? adjective.caseName
    if (!scope.cases.has(caseName)) return <span style={styleFor(genderColor)}>{original}</span>
    return <><span style={styleFor(genderColor)}>{original.slice(0, -adjective.ending.length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases[caseName])}>{original.slice(-adjective.ending.length)}</span></>
  }

  const past = scope.pastTense ? lower.match(/л[аои]?$/u) : null
  if (past && lower.length > past[0].length + 1) return <><span>{original.slice(0, -past[0].length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-past[0].length)}</span></>
  return original
}

/**
 * Some noun stems are also the opening of an unrelated adjective, and a bare prefix match paints
 * that adjective as a noun: "сильный" is not a form of "сила", "светлое" is not "свет". Each entry
 * names the continuation that marks the other word, chosen so no real case form of the noun starts
 * with it — "имени" still reaches "им", only "именительный" steps aside.
 */
const nounStemExceptions: Record<string, string> = {
  'свет': 'светл',           // светлый, светлая, светлое, светлые
  'сил': 'сильн',            // сильный, сильная, сильные
  'выход': 'выходн',         // выходной, выходные
  'им': 'именительн',        // именительный (падеж)
  'родител': 'родительн',    // родительный (падеж)
}

const infinitiveSuffix = /(?:ться|тись|чься|ть|ти|чь)$/u

function isInfinitive(word: string) {
  if (word.length < 4 || !infinitiveSuffix.test(word)) return false
  const noun = findNoun(word)
  return !noun || word.length - noun.stem.length > 2
}

function findNoun(word: string) {
  return nounStems.find(({ stem }) => {
    if (!word.startsWith(stem)) return false
    const exception = nounStemExceptions[stem]
    return !(exception && word.startsWith(exception))
  })
}

function renderVerbEnding(original: string, { ending, reflexive }: { ending: string; reflexive: string }): ReactNode {
  const rootLength = original.length - ending.length - reflexive.length
  return <>
    <span>{original.slice(0, rootLength)}</span>
    <span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.personalEnding)}>{original.slice(rootLength, rootLength + ending.length)}</span>
    {reflexive && <span>{original.slice(rootLength + ending.length)}</span>}
  </>
}

function findVerbEnding(word: string, endings: string[]) {
  if (!verbStems.some((stem) => word.startsWith(stem))) return undefined
  // Reflexive verbs (заниматься → занимаюсь) tack -ся/-сь onto the personal ending, so the
  // ending pattern has to be matched before that suffix, not at the literal end of the word.
  const reflexive = word.match(/(ся|сь)$/u)?.[0] ?? ''
  const core = reflexive ? word.slice(0, -reflexive.length) : word
  const ending = endings.find((candidate) => core.endsWith(candidate) && core.length > candidate.length + 1)
  return ending ? { ending, reflexive } : undefined
}

/**
 * The case an adjective in front of a noun marks, if its ending carries one. Words that look like
 * an adjective but hold no case — the possessives, the stressed -ой nominatives (какой, большой),
 * the uncoloured function words — are skipped, so they never push a case onto the next noun.
 */
function adjectiveCase(word: string): CaseName | null {
  if (!word || fullGenderWords[word] || masculineOyWords.has(word) || blackWords.has(word)) return null
  const adjective = adjectiveEndings.find(({ ending }) => word.endsWith(ending) && word.length > ending.length + 1)
  return adjective?.caseName ?? null
}

function inferCase(previousWord: string, previousPreviousWord: string, word: string): CaseName | null {
  if (/^(виж|люб|зна|помн|встреч|слыш|чит|пиш|слуш|смотр|уч|понима|объясня|исправля|дела)/u.test(previousWord)) return 'accusative'
  if (previousWord === 'нет') return 'genitive'
  // Verbs that govern the dative on their own, without a preposition: звонить/помогать/дарить
  // кому? — the doc for day 14 marks "звонить другу" as dative, and "к" is not always there.
  if (/^(звон|перезвон|помога|помог|дар|подар)/u.test(previousWord)) return 'dative'
  if (previousWord === 'к') return 'dative'
  if (['с', 'со', 'над', 'под', 'между'].includes(previousWord)) return 'instrumental'
  if (['у', 'без', 'для', 'до', 'от', 'из', 'около'].includes(previousWord)) return 'genitive'
  if (['через', 'про'].includes(previousWord)) return 'accusative'
  if (['о', 'об', 'при'].includes(previousWord)) return 'prepositional'
  if (['в', 'на'].includes(previousWord)) return /[ую]$/u.test(word) ? 'accusative' : 'prepositional'
  if (['в', 'на'].includes(previousPreviousWord)) return 'prepositional'
  return null
}

function styleFor(color: string) {
  return color === '#FFFF00' ? { color, WebkitTextStroke: '0.35px #8a7600' } : { color }
}
