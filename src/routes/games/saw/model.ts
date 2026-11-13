export type SawCharacter = 'penguin' | 'panda' | 'pero'
export type SawEmotion = 'idle' | 'speaking' | 'silence' | 'panic' | 'happy'
export type SawPhase = 'ready' | 'starting' | 'playing' | 'impact' | 'cut' | 'won'

export type SawResult = {
  confidence: number
  words: number
  favouriteWord: string
  spokenSeconds: number
  durationSeconds: number
  reason: 'complete' | 'silence' | 'surrender'
}

export const ROUND_SECONDS = 60
export const CONTACT_DURATION_MS = 1100
export const SAW_CHARACTERS: SawCharacter[] = ['penguin', 'panda', 'pero']
export const SAW_TOPICS = [
  { id: 'everyday', label: 'Повседневная жизнь' },
  { id: 'work', label: 'Работа и планы' },
  { id: 'friends', label: 'Друзья и семья' },
  { id: 'travel', label: 'Путешествия' },
  { id: 'choices', label: 'Выбор и привычки' },
  { id: 'imagination', label: 'Воображение' },
]
export const SAW_CHARACTER_INFO = {
  penguin: { name: 'Пингвин', trait: 'Строгий', location: 'Стальной цех', title: 'Железный оратор', quote: 'Говори по делу. Я слушаю.', accent: '#69d9ff' },
  panda: { name: 'Панда', trait: 'Заботливая', location: 'Старый чердак', title: 'Спасённый друг', quote: 'Не бойся. Давай вместе!', accent: '#ffc38a' },
  pero: { name: 'Перо', trait: 'Саркастичный', location: 'Театр теней', title: 'Мастер демагогии', quote: 'Удиви меня. Время пошло!', accent: '#d5a2ff' },
} as const

export function sawCharacterImage(character: SawCharacter, emotion: SawEmotion = 'idle') {
  const pose = emotion === 'happy' || emotion === 'speaking' ? 'confident' : emotion === 'silence' || emotion === 'panic' ? 'danger' : 'idle'
  return `/games/arra/v3/${character}-${pose}.webp`
}
