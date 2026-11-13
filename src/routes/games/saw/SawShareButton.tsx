import { useEffect, useState } from 'react'
import { Download, LoaderCircle, Share2 } from 'lucide-react'
import { SAW_CHARACTER_INFO, sawCharacterImage } from './model'
import type { SawCharacter, SawResult } from './model'

const GAME_URL = 'https://russian.gg/games/arra'
const FONT = '"Nunito Variable", Nunito, Arial, sans-serif'

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Не удалось загрузить изображение героя.'))
    image.src = source
  })
}

function writeFit(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, weight = 800) {
  context.font = `${weight} ${size}px ${FONT}`
  while (context.measureText(text).width > maxWidth && size > 20) {
    size -= 1
    context.font = `${weight} ${size}px ${FONT}`
  }
  context.fillText(text, x, y, maxWidth)
}

function imageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  context.drawImage(image, x + (width - image.naturalWidth * scale) / 2, y + (height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale)
}

async function createResultCard(character: SawCharacter, result: SawResult) {
  const info = SAW_CHARACTER_INFO[character]
  const won = result.reason === 'complete'
  const [hero, room, qrCode] = await Promise.all([
    loadImage(sawCharacterImage(character, won ? 'happy' : 'panic')),
    loadImage(`/games/arra/v3/${character}-room.webp`),
    import('qrcode'),
    document.fonts.load(`800 60px ${FONT}`),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не удалось создать карточку результата.')

  context.fillStyle = '#0c1218'
  context.fillRect(0, 0, 1080, 1920)
  context.save()
  context.beginPath()
  context.rect(0, 0, 1080, 1300)
  context.clip()
  imageCover(context, room, 0, 0, 1080, 1300)
  context.restore()
  const shade = context.createLinearGradient(0, 0, 0, 1440)
  shade.addColorStop(0, '#0c1218eb')
  shade.addColorStop(0.35, '#0c121880')
  shade.addColorStop(0.7, '#0c12181a')
  shade.addColorStop(1, '#0c1218')
  context.fillStyle = shade
  context.fillRect(0, 0, 1080, 1440)

  context.fillStyle = info.accent
  writeFit(context, 'russian.gg', 66, 96, 440, 42)
  context.textAlign = 'right'
  context.fillStyle = '#d4ddd9'
  writeFit(context, 'ГОЛОСОВОЕ ИСПЫТАНИЕ', 1014, 92, 480, 26)
  context.textAlign = 'left'
  context.fillStyle = '#fff3d8'
  writeFit(context, 'ПИЛА', 64, 243, 952, 140, 900)
  context.fillStyle = won ? '#c4f6c6' : '#f7d5c5'
  writeFit(context, won ? 'Я прошёл проверку' : 'Не сдаюсь.', 66, 337, 948, 65, 900)
  writeFit(context, won ? 'на прочность!' : 'Попробую ещё!', 66, 415, 948, 65, 900)

  const heroScale = Math.min(830 / hero.naturalWidth, 770 / hero.naturalHeight)
  const heroWidth = hero.naturalWidth * heroScale
  const heroHeight = hero.naturalHeight * heroScale
  context.save()
  context.shadowColor = info.accent
  context.shadowBlur = 35
  context.drawImage(hero, (1080 - heroWidth) / 2, 440 + (770 - heroHeight), heroWidth, heroHeight)
  context.restore()
  context.textAlign = 'center'
  context.fillStyle = '#fff3d8'
  writeFit(context, won ? info.title : info.name, 540, 1234, 950, 52, 900)
  context.fillStyle = info.accent
  writeFit(context, `${info.name} · ${info.trait}`, 540, 1283, 950, 28)

  context.fillStyle = '#1c2933'
  context.beginPath()
  context.roundRect(64, 1330, 952, 286, 32)
  context.fill()
  context.strokeStyle = `${info.accent}66`
  context.lineWidth = 2
  context.stroke()
  const stats = [
    [`${Math.round(result.confidence)}%`, 'УВЕРЕННОСТЬ'],
    [String(result.words), 'СЛОВ'],
    [`${Math.round(result.spokenSeconds)} с`, 'ВРЕМЯ РЕЧИ'],
  ]
  stats.forEach(([value, label], index) => {
    const x = 230 + index * 310
    context.fillStyle = '#fff3d8'
    writeFit(context, value, x, 1430, 270, 66, 900)
    context.fillStyle = '#afc2c9'
    writeFit(context, label, x, 1470, 270, 23)
  })
  context.strokeStyle = '#ffffff1c'
  context.beginPath()
  context.moveTo(100, 1504)
  context.lineTo(980, 1504)
  context.stroke()
  context.fillStyle = '#d3dfe1'
  writeFit(context, `Любимое слово: ${result.favouriteWord ? `«${result.favouriteWord}»` : '—'}`, 540, 1573, 875, 34)

  const qrCanvas = document.createElement('canvas')
  await qrCode.toCanvas(qrCanvas, GAME_URL, { width: 212, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0c1218', light: '#fffaf0' } })
  context.fillStyle = '#fffaf0'
  context.beginPath()
  context.roundRect(792, 1680, 224, 224, 18)
  context.fill()
  context.drawImage(qrCanvas, 798, 1686, 212, 212)
  context.textAlign = 'left'
  context.fillStyle = info.accent
  writeFit(context, 'Сможешь лучше?', 66, 1730, 670, 52, 900)
  context.fillStyle = '#fff3d8'
  writeFit(context, 'Сыграй в «Пилу»', 66, 1792, 670, 37)
  context.fillStyle = '#a7bbc5'
  writeFit(context, 'russian.gg/games/arra', 66, 1854, 670, 30)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Не удалось сохранить карточку.')), 'image/png'))
  return new File([blob], `russian-gg-arra-${character}.png`, { type: 'image/png' })
}

export function SawShareButton({ character, result, className }: { character: SawCharacter; result: SawResult; className?: string }) {
  const [file, setFile] = useState<File>()
  const [preparationError, setPreparationError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'idle' | 'sharing' | 'copied' | 'downloaded' | 'failed'>('idle')
  const { confidence, words, favouriteWord, spokenSeconds, durationSeconds, reason } = result
  useEffect(() => {
    let cancelled = false
    setFile(undefined)
    setPreparationError(false)
    setStatus('idle')
    void createResultCard(character, { confidence, words, favouriteWord, spokenSeconds, durationSeconds, reason }).then((prepared) => {
      if (!cancelled) setFile(prepared)
    }).catch(() => { if (!cancelled) setPreparationError(true) })
    return () => { cancelled = true }
  }, [character, confidence, words, favouriteWord, spokenSeconds, durationSeconds, reason, attempt])

  async function share() {
    if (!file || status === 'sharing') return
    setStatus('sharing')
    const text = [
      'Пила: Детектор лжи — Russian.gg',
      reason === 'complete' ? `Мой титул: ${SAW_CHARACTER_INFO[character].title}` : 'Мой результат голосового испытания',
      `Уверенность: ${Math.round(confidence)}% · Слов: ${words} · Время речи: ${Math.round(spokenSeconds)} с`,
      ...(favouriteWord ? [`Любимое слово: «${favouriteWord}»`] : []),
      GAME_URL,
    ].join('\n')
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: 'Пила — мой результат', text, files: [file] })
        setStatus('idle')
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') { setStatus('idle'); return }
      }
    }
    const url = URL.createObjectURL(file)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.append(link)
      link.click()
      link.remove()
      try {
        await navigator.clipboard.writeText(text)
        setStatus('copied')
      } catch { setStatus('downloaded') }
    } catch { setStatus('failed') }
    finally { window.setTimeout(() => URL.revokeObjectURL(url), 30_000) }
  }

  const preparing = !file && !preparationError
  const busy = preparing || status === 'sharing'
  return <>
    <button type="button" className={className ?? 'arra-share'} data-game-share="arra" disabled={busy} aria-busy={busy}
      onClick={() => preparationError ? setAttempt((value) => value + 1) : void share()}>
      {busy ? <LoaderCircle size={18} className="arra-share-spinner" aria-hidden="true" /> : status === 'copied' || status === 'downloaded' ? <Download size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
      {preparing ? 'Готовим карточку…' : preparationError ? 'Создать карточку ещё раз' : 'Поделиться'}
    </button>
    {(status === 'copied' || status === 'downloaded') && <p className="arra-share-message" role="status">{status === 'copied' ? 'Карточка сохранена. Результат и ссылка скопированы.' : 'Карточка сохранена. Ссылка на игру есть на изображении.'}</p>}
    {(preparationError || status === 'failed') && <p className="arra-share-message" role="alert">Не удалось подготовить результат. Попробуй ещё раз.</p>}
  </>
}
