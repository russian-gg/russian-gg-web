import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useLocale } from '../../../lib/i18n'
import { lifeCopies } from './copy'
import './life.css'

export function LifeCard() {
  const { locale } = useLocale()
  const copy = lifeCopies[locale]
  return <Link to="/games/fight-for-life" className="life-card">
    <div className="life-card-copy"><span>{copy.tag}</span><h2 lang="ru">Борьба за жизнь</h2><p>{copy.intro}</p><strong>{copy.start}<ArrowRight size={17} /></strong></div>
    <img src="/games/fight-for-life/characters/penguin.webp" alt="" loading="lazy" width="512" height="512" />
  </Link>
}
