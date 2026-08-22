import type { ReactNode } from 'react'

export const RUSSIAN_COLOR_SYSTEM = {
  gender: {
    masculine: '#0000FF',
    feminine: '#FF2400',
    neuter: '#FFFF00',
  },
  cases: {
    genitive: '#8B00FF',
    dative: '#964B00',
    accusative: '#00BFFF',
    instrumental: '#44944A',
    prepositional: '#480607',
  },
  verbs: {
    personalEnding: '#ED3CCA',
    pastSuffixAndEnding: '#F984E5',
  },
} as const

type Gender = keyof typeof RUSSIAN_COLOR_SYSTEM.gender
type CaseName = keyof typeof RUSSIAN_COLOR_SYSTEM.cases

const nounStems: Array<{ stem: string; gender: Gender }> = [
  ...'учебник,зарядник,интернет,кошелёк,кошелек,документ,проездн,наушник,бензин,учител,инженер,студент,рабоч,начальник,директор,телефон,звонок,сосед,ключ,этаж,офис,друг,голос,вопрос,ответ,язык,текст,диалог,фильм,хлеб,диван,телевизор,порт,стол,стул,муж,дом,пап,врач,номер,чай,парк,мёд,мяч,мир,мост,брат,дедушк,дяд,отец,человек,ребёнок,ребенок,родител,сын,мальчик,зонт,свет'.split(',').map((stem) => ({ stem, gender: 'masculine' as const })),
  ...'зарядк,деньг,иде,ручк,тетрад,ед,професси,квартир,лестниц,комнат,зарплат,больниц,компани,грамматик,музык,стать,гитар,ошибк,дорог,работ,школ,книг,газет,правд,фраз,двер,мам,панд,семь,сестр,бабушк,тёт,тет,девушк,доч,жен,женщин'.split(',').map((stem) => ({ stem, gender: 'feminine' as const })),
  ...'упражнен,письм,радио,мюсл,окн,мор,слов,мыл,семейств,врем,им'.split(',').map((stem) => ({ stem, gender: 'neuter' as const })),
].sort((a, b) => b.stem.length - a.stem.length)

const personalEndings = [
  'аетесь', 'яетесь', 'итесь', 'аешь', 'яешь', 'аьют', 'яют', 'уют', 'аете', 'яете',
  'ишь', 'ешь', 'ете', 'ите', 'ает', 'яет', 'ует', 'ют', 'ут', 'ят', 'ат', 'ем', 'им', 'ю', 'у',
]

const verbStems = [
  'работ', 'говор', 'чит', 'понима', 'слыш', 'жив', 'зов', 'хоч', 'дела', 'приглас',
  'люб', 'уч', 'игра', 'смотр', 'слуш', 'повтор', 'отвеч', 'пиш', 'звон', 'перезвон',
]

const adjectiveEndings: Array<{ ending: string; gender: Gender | null; caseName?: CaseName }> = [
  { ending: 'ыми', gender: null, caseName: 'instrumental' },
  { ending: 'ими', gender: null, caseName: 'instrumental' },
  { ending: 'ого', gender: 'masculine', caseName: 'genitive' },
  { ending: 'его', gender: 'masculine', caseName: 'genitive' },
  { ending: 'ому', gender: 'masculine', caseName: 'dative' },
  { ending: 'ему', gender: 'masculine', caseName: 'dative' },
  { ending: 'ую', gender: 'feminine', caseName: 'accusative' },
  { ending: 'юю', gender: 'feminine', caseName: 'accusative' },
  { ending: 'ой', gender: 'feminine', caseName: 'instrumental' },
  { ending: 'ей', gender: 'feminine', caseName: 'instrumental' },
  { ending: 'ым', gender: 'masculine', caseName: 'instrumental' },
  { ending: 'им', gender: 'masculine', caseName: 'instrumental' },
  { ending: 'ом', gender: 'masculine', caseName: 'prepositional' },
  { ending: 'ем', gender: 'masculine', caseName: 'prepositional' },
  { ending: 'ая', gender: 'feminine' },
  { ending: 'яя', gender: 'feminine' },
  { ending: 'ое', gender: 'neuter' },
  { ending: 'ее', gender: 'neuter' },
  { ending: 'ый', gender: 'masculine' },
  { ending: 'ий', gender: 'masculine' },
  { ending: 'ой', gender: 'masculine' },
  { ending: 'ые', gender: null },
  { ending: 'ие', gender: null },
]

export function RussianText({ text }: { text: string }) {
  const pieces = text.split(/([А-Яа-яЁё]+)/g)
  const words = pieces.filter((piece) => /[А-Яа-яЁё]/u.test(piece))
  let wordIndex = 0
  let previousWord = ''

  return <>{pieces.map((piece, index) => {
    if (!/[А-Яа-яЁё]/u.test(piece)) return <span key={index}>{piece}</span>
    const lower = piece.toLocaleLowerCase('ru-RU')
    const nextWord = words[wordIndex + 1]?.toLocaleLowerCase('ru-RU') ?? ''
    const rendered = colorRussianWord(piece, lower, previousWord, nextWord)
    previousWord = lower
    wordIndex += 1
    return <span key={index}>{rendered}</span>
  })}</>
}

function colorRussianWord(original: string, lower: string, previousWord: string, nextWord: string): ReactNode {
  if (/^[аиу]$/u.test(lower)) return <span style={styleFor('#FF2400')}>{original}</span>

  const personalEnding = personalEndings.find((ending) => lower.endsWith(ending) && lower.length > ending.length + 1)
  if (personalEnding && verbStems.some((stem) => lower.startsWith(stem))) return <>
    <span>{original.slice(0, -personalEnding.length)}</span>
    <span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.personalEnding)}>{original.slice(-personalEnding.length)}</span>
  </>

  const knownPast = lower.match(/л[аои]?$/u)
  if (knownPast && (verbStems.some((stem) => lower.startsWith(stem)) || lower.startsWith('бы'))) {
    return <>
      <span>{original.slice(0, -knownPast[0].length)}</span>
      <span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-knownPast[0].length)}</span>
    </>
  }

  const noun = findNoun(lower)
  if (noun) {
    const caseName = inferCase(previousWord, lower)
    const root = original.slice(0, noun.stem.length)
    const ending = original.slice(noun.stem.length)
    return <>
      <span style={styleFor(RUSSIAN_COLOR_SYSTEM.gender[noun.gender])}>{root}</span>
      {ending && (caseName
        ? <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases[caseName])}>{ending}</span>
        : <span>{ending}</span>)}
    </>
  }

  const adjective = adjectiveEndings.find(({ ending }) => lower.endsWith(ending) && lower.length > ending.length + 1)
  if (adjective) {
    const nextNounGender = findNoun(nextWord)?.gender
    const gender = nextNounGender ?? adjective.gender
    if (!gender) return original
    const genderColor = RUSSIAN_COLOR_SYSTEM.gender[gender]
    if (!adjective.caseName) return <span style={styleFor(genderColor)}>{original}</span>
    return <>
      <span style={styleFor(genderColor)}>{original.slice(0, -adjective.ending.length)}</span>
      <span style={styleFor(RUSSIAN_COLOR_SYSTEM.cases[adjective.caseName])}>{original.slice(-adjective.ending.length)}</span>
    </>
  }

  const past = lower.match(/л[аои]?$/u)
  if (past && lower.length > past[0].length + 1) {
    return <>
      <span>{original.slice(0, -past[0].length)}</span>
      <span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.pastSuffixAndEnding)}>{original.slice(-past[0].length)}</span>
    </>
  }

  if (personalEnding) return <>
    <span>{original.slice(0, -personalEnding.length)}</span>
    <span style={styleFor(RUSSIAN_COLOR_SYSTEM.verbs.personalEnding)}>{original.slice(-personalEnding.length)}</span>
  </>

  return original
}

function findNoun(word: string) {
  return nounStems.find(({ stem }) => word.startsWith(stem))
}

function inferCase(previousWord: string, word: string): CaseName | null {
  if (previousWord === 'нет') return 'genitive'
  if (previousWord === 'к') return 'dative'
  if (['с', 'со', 'над', 'под', 'между'].includes(previousWord)) return 'instrumental'
  if (['у', 'без', 'для', 'до', 'от', 'из', 'около'].includes(previousWord)) return 'genitive'
  if (['через', 'про'].includes(previousWord)) return 'accusative'
  if (['о', 'об', 'при'].includes(previousWord)) return 'prepositional'
  if (['в', 'на'].includes(previousWord)) return /[ую]$/u.test(word) ? 'accusative' : 'prepositional'
  return null
}

function styleFor(color: string) {
  return color === '#FFFF00'
    ? { color, textShadow: '0 0 1px #695900, 0 0 2px #695900' }
    : { color }
}
