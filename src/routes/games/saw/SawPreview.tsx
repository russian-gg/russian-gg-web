import { useT } from '../../../lib/i18n'
import { prefersReducedMotion, useDemoClock } from '../previews/demo'
import { SawGameView } from './SawGameView'

const WORDS = 'Меня зовут Азиз. Я работаю в школе. Я люблю свою работу и каждый день говорю по-русски.'.split(' ')

export function SawPreview({ running }: { running: boolean }) {
  const t = useT().arcade.saw
  const time = useDemoClock(running) % 12
  const speaking = time >= 4 && time < 10
  const blade = time < 4 ? 22 + time * 14 : time < 10 ? Math.max(8, 78 - (time - 4) * 12) : 8 + (time - 10) * 7
  const transcript = speaking ? WORDS.slice(0, Math.floor((time - 4) * 3) + 1).join(' ') : ''
  return <SawGameView phase="playing" blade={blade} secondsLeft={Math.max(1, 53 - Math.floor(time))} score={2}
    round={0} question={t.questions[0]} transcript={transcript} speaking={speaking}
    preview animated={running && !prefersReducedMotion()} />
}
