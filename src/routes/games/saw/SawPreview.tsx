import { prefersReducedMotion, useDemoClock } from '../previews/demo'
import { SawGameView } from './SawGameView'
import { SAW_CHARACTERS, SAW_CHARACTER_INFO } from './model'
import type { SawEmotion } from './model'

const DEMOS = {
  penguin: { question: 'Что ты делаешь каждый день?', answer: 'Каждый день я работаю и учу русский язык. Вечером я читаю и гуляю с друзьями.' },
  panda: { question: 'Что делает твой день хорошим?', answer: 'Мне нравится завтракать с семьёй. Мы пьём чай и рассказываем друг другу о своих планах.' },
  pero: { question: 'Ты выбираешь чай или кофе? Почему?', answer: 'Я выбираю чай, потому что он помогает мне отдыхать. Люблю пить его вечером и читать книгу.' },
}

export function SawPreview({ running }: { running: boolean }) {
  const clock = useDemoClock(running) % 45
  const character = SAW_CHARACTERS[Math.floor(clock / 15)]
  const time = clock % 15
  const speaking = time >= 4 && time < 8
  const impact = time >= 13.8
  const blade = time < 4 ? 12 + time * 14 : time < 8 ? 68 - (time - 4) * 12 : Math.min(100, 20 + (time - 8) * (80 / 5.8))
  const emotion: SawEmotion = speaking ? time > 7 ? 'happy' : 'speaking' : blade >= 80 ? 'panic' : time < 1 ? 'idle' : 'silence'
  const demo = DEMOS[character]
  const transcript = speaking ? demo.answer.split(' ').slice(0, Math.floor((time - 4) * 4) + 1).join(' ') : ''
  const volume = speaking ? .3 + Math.abs(Math.sin(time * 7)) * .65 : 0
  return <SawGameView key={character} phase={impact ? 'impact' : 'playing'} blade={blade} secondsLeft={53 - Math.floor(time)} score={2}
    round={0} question={demo.question} transcript={transcript} speaking={speaking} character={character} emotion={emotion}
    reply={speaking ? SAW_CHARACTER_INFO[character].quote : ''} volume={volume}
    preview animated={running && !prefersReducedMotion()} />
}
