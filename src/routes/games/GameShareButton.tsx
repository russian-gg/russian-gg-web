import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { useLocale } from '../../lib/i18n'

const copies = {
  uz: { share: 'Ulashish', copied: 'Natija nusxalandi', failed: 'Ulashib bo‘lmadi. Qayta urinib ko‘ring.' },
  ru: { share: 'Поделиться', copied: 'Результат скопирован', failed: 'Не удалось поделиться. Попробуйте ещё раз.' },
  en: { share: 'Share', copied: 'Result copied', failed: 'Could not share. Please try again.' },
}

export function GameShareButton({ slug, title, result, className }: {
  slug: string; title: string; result: string[]; className?: string
}) {
  const { locale } = useLocale()
  const copy = copies[locale]
  const [status, setStatus] = useState<'idle' | 'sharing' | 'copied' | 'failed'>('idle')

  async function share() {
    if (status === 'sharing') return
    setStatus('sharing')
    const url = `https://russian.gg/games/${encodeURIComponent(slug)}`
    const text = [title, ...result].join('\n')
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url })
          setStatus('idle')
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') { setStatus('idle'); return }
        }
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setStatus('copied')
    } catch { setStatus('failed') }
  }

  return <>
    <button type="button" data-game-share={slug} className={className ?? 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-hairline bg-ground-raised px-6 py-3 text-sm font-extrabold text-ink hover:border-ink-faint disabled:opacity-60'}
      disabled={status === 'sharing'} aria-busy={status === 'sharing'} onClick={() => void share()}>
      <Share2 aria-hidden="true" size={19} />{status === 'copied' ? copy.copied : copy.share}
    </button>
    {status === 'failed' && <p role="alert" className="basis-full text-center text-sm">{copy.failed}</p>}
  </>
}
