import type { ReactNode } from 'react'

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

const nounStems: Array<{ stem: string; gender: Gender }> = [
  ...'учебник,зарядник,интернет,кошелёк,кошелек,документ,проездн,наушник,бензин,магазин,фонтан,вокзал,театр,город,музей,учител,инженер,студент,рабоч,начальник,директор,телефон,звонок,сосед,ключ,этаж,офис,друг,друз,люд,дет,голос,вопрос,ответ,язык,текст,диалог,фильм,хлеб,диван,телевизор,порт,стол,муж,дом,пап,врач,номер,чай,парк,мёд,мяч,мир,мост,брат,дедушк,дяд,отец,человек,ребёнок,ребенок,родител,сын,мальчик,зонт,свет,шум,день,стул,сыр,лист,коллег,университет,завод,топор,футбол,нос,ноль'.split(',').map((stem) => ({ stem, gender: 'masculine' as const })),
  ...'зарядк,деньг,иде,ручк,тетрад,улиц,площад,рек,ед,професси,квартир,лестниц,комнат,зарплат,больниц,компани,грамматик,музык,стать,гитар,ошибк,дорог,работ,школ,книг,газет,правд,фраз,двер,мам,семь,сестр,бабушк,тёт,тет,девушк,доч,жен,женщин,земл,фамил,рам,мук,нян'.split(',').map((stem) => ({ stem, gender: 'feminine' as const })),
  ...'удовольстви,упражнен,письм,радио,мюсл,здан,детств,событ,кафе,метр,окн,мор,слов,мыл,семейств,врем,им,утр,правил'.split(',').map((stem) => ({ stem, gender: 'neuter' as const })),
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
const verbStems = ['работ', 'говор', 'чит', 'понима', 'слыш', 'жив', 'зов', 'хоч', 'дела', 'приглас', 'люб', 'вид', 'зна', 'помн', 'встреч', 'уч', 'игра', 'смотр', 'слуш', 'повтор', 'отвеч', 'пиш', 'звон', 'перезвон', 'дума', 'отдых', 'гуля', 'объясня', 'исправля', 'помога', 'заним']
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
  // The plural forms (мои, твои, чьи…) stay uncoloured: they span all three genders.
  ...Object.fromEntries(['мой', 'твой', 'наш', 'ваш', 'свой', 'чей'].map((word) => [word, 'masculine' as const])),
  ...Object.fromEntries(['моя', 'твоя', 'наша', 'ваша', 'своя', 'чья'].map((word) => [word, 'feminine' as const])),
  ...Object.fromEntries(
    ['моё', 'мое', 'твоё', 'твое', 'наше', 'ваше', 'своё', 'свое', 'чьё', 'чье'].map((word) => [word, 'neuter' as const]),
  ),
}

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
  const pieces = text.split(/([\p{Script=Cyrillic}][\p{Script=Cyrillic}\p{M}]*)/gu)
  const words = pieces.filter((piece) => /[А-Яа-яЁё]/u.test(piece))
  const singleVowel = /^[АОУ]$/u.test(text.trim())
  let wordIndex = 0
  let previousWord = ''
  let previousPreviousWord = ''

  return <>{pieces.map((piece, index) => {
    if (!/[А-Яа-яЁё]/u.test(piece)) return <span key={index}>{piece}</span>
    const lower = normalizeWord(piece)
    const nextWord = normalizeWord(words[wordIndex + 1] ?? '')
    const rendered = singleVowel || (phoneticVowels && /^[аоу]$/u.test(lower))
      ? <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender.feminine)}>{piece}</span>
      : colorRussianWord(piece, lower, previousWord, previousPreviousWord, nextWord)
    previousPreviousWord = previousWord
    previousWord = lower
    wordIndex += 1
    return <span key={index}>{rendered}</span>
  })}</>
}

function normalizeWord(word: string) {
  return word.toLocaleLowerCase('ru-RU').replace(/[̀́]/gu, '')
}

function colorRussianWord(original: string, lower: string, previousWord: string, previousPreviousWord: string, nextWord: string): ReactNode {
  if (blackWords.has(lower)) return original
  if (lower === 'с' || lower === 'со') return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases.instrumental)}>{original}</span>
  if (lower === 'на') return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases.prepositional)}>{original}</span>

  const fullGender = fullGenderWords[lower]
  if (fullGender) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[fullGender])}>{original}</span>
  if (lower === 'род' && fullGenderWords[previousWord]) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[fullGenderWords[previousWord]])}>{original}</span>

  const explicitEnding = personalEndingOverrides[lower]
  if (explicitEnding) return <><span>{original.slice(0, -explicitEnding.length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.personalEnding)}>{original.slice(-explicitEnding.length)}</span></>

  const pastTenseOverride = pastTenseWordOverrides[lower]
  if (pastTenseOverride) return <><span>{original.slice(0, -pastTenseOverride.length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-pastTenseOverride.length)}</span></>

  const knownPast = lower.match(/л[аои]?$/u)
  if (knownPast && (verbStems.some((stem) => lower.startsWith(stem)) || lower.startsWith('бы'))) {
    return <><span>{original.slice(0, -knownPast[0].length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-knownPast[0].length)}</span></>
  }

  const longPresentEnding = findVerbEnding(lower, presentTenseLongEndings)
  if (longPresentEnding) return renderVerbEnding(original, longPresentEnding)

  const noun = findNoun(lower)
  if (noun) {
    // Bare -ы/-и (студенты), the substantivised-adjective plural -ие/-ые (рабочие), and the
    // irregular -ья plural (друзья, братья) are all unambiguous masculine plural markers — no
    // singular case of these nouns ends that way. Russian plurals don't carry gender at all
    // (unlike the singular forms this whole system teaches), so colouring one by its dictionary
    // gender would teach the wrong lesson; leave it uncoloured, like plural possessives already are.
    const rawEnding = lower.slice(noun.stem.length)
    if (noun.gender === 'masculine' && ['ы', 'и', 'ые', 'ие', 'ья'].includes(rawEnding)) return original

    const caseName = inferCase(previousWord, previousPreviousWord, lower)
    if (!caseName) return <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[noun.gender])}>{original}</span>
    const root = original.slice(0, noun.stem.length)
    const ending = original.slice(noun.stem.length)
    return <><span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[noun.gender])}>{root}</span>{ending && <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases[caseName])}>{ending}</span>}</>
  }

  const shortPresentEnding = findVerbEnding(lower, presentTenseShortEndings)
  if (shortPresentEnding) return renderVerbEnding(original, shortPresentEnding)

  const adjective = adjectiveEndings.find(({ ending }) => lower.endsWith(ending) && lower.length > ending.length + 1)
  if (adjective) {
    const gender = findNoun(nextWord)?.gender ?? adjective.gender
    if (!gender) return original
    const genderColor = RUSSIAN_COLOR_SYSTEM.gender[gender]
    if (!adjective.caseName) return <span style={styleFor(genderColor)}>{original}</span>
    return <><span style={styleFor(genderColor)}>{original.slice(0, -adjective.ending.length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases[adjective.caseName])}>{original.slice(-adjective.ending.length)}</span></>
  }

  const past = lower.match(/л[аои]?$/u)
  if (past && lower.length > past[0].length + 1) return <><span>{original.slice(0, -past[0].length)}</span><span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-past[0].length)}</span></>
  return original
}

function findNoun(word: string) { return nounStems.find(({ stem }) => word.startsWith(stem)) }

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

function inferCase(previousWord: string, previousPreviousWord: string, word: string): CaseName | null {
  if (/^(виж|люб|зна|помн|встреч|слыш|чит|пиш|слуш|смотр|уч|понима|объясня|исправля|дела)/u.test(previousWord)) return 'accusative'
  if (previousWord === 'нет') return 'genitive'
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
