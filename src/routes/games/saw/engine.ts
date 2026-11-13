import type { SawResult } from './model'

const fillers = new Set(['ну', 'эм', 'ээ', 'типа'])

export function russianWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}]+/gu) ?? []).filter((word) => /^[а-яё]+$/.test(word))
}

export function contentWords(text: string): string[] {
  return russianWords(text.replace(/(?<![\p{L}])как\s+бы(?![\p{L}])/giu, ' ')).filter((word) => !fillers.has(word) && word !== 'э')
}

export function fillerCount(text: string): number {
  return (text.toLowerCase().match(/(?<![\p{L}])(?:э(?:[-– ]?э)+|эм|ну|типа|как\s+бы)(?![\p{L}])/gu) ?? []).length
}

export function nextThreat(threat: number, seconds: number, speaking: boolean, newFillers = 0): number {
  return Math.max(0, Math.min(100, threat + Math.max(0, seconds) * (speaking ? -5 : 10) + Math.max(0, newFillers) * 5))
}

export function resultFor(text: string, spokenSeconds: number, durationSeconds: number, reason: SawResult['reason']): SawResult {
  const words = russianWords(text)
  const frequency = new Map<string, number>()
  for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1)
  const favouriteWord = [...frequency].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return {
    words: words.length, favouriteWord, spokenSeconds: Math.round(spokenSeconds), durationSeconds: Math.round(durationSeconds), reason,
    confidence: durationSeconds > 0 ? Math.round(Math.min(100, Math.max(0, spokenSeconds / durationSeconds * 100))) : 0,
  }
}
