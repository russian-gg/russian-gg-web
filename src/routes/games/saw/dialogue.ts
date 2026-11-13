import { api, RequestError } from '../../../lib/api'
import type { SawCharacter } from './model'

export type SawReply = { characterReply: string; animation: 'happy' | 'angry' | 'sad' | 'mocking'; threatChange: number; isFallback?: boolean }
export type SawMessage = { role: 'user' | 'assistant'; text: string }

export function deadline<T>(request: Promise<T>, milliseconds = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), milliseconds)
    request.then(resolve, reject).finally(() => window.clearTimeout(timer))
  })
}

export async function getSawReply(character: SawCharacter, topic: string, text: string, history: SawMessage[], event: 'opening' | 'answer' | 'silence'): Promise<SawReply> {
  const reply = await deadline(api.post<SawReply>('/arra/reply', {
    character, level: 'A2', topic, text: text.slice(-1200),
    history: history.slice(-8).map((message) => ({ ...message, text: message.text.slice(-600) })), event,
  }))
  if (!reply || !reply.characterReply?.trim() || !/[а-яё]/i.test(reply.characterReply) || /[a-zўқғҳ]/i.test(reply.characterReply)) throw new Error('invalid_reply')
  return { ...reply, isFallback: reply.isFallback === true, threatChange: Number.isFinite(reply.threatChange) ? Math.min(10, Math.max(-10, reply.threatChange)) : 0 }
}

export function isSawLanguageError(error: unknown): boolean {
  return error instanceof RequestError && (error.status === 400 || error.status === 422) && error.code === 'arra_russian_required'
}

export function sawError(error: unknown): string {
  if (error instanceof RequestError) {
    if (error.status === 401) return 'Войди в свой аккаунт, чтобы начать игру.'
    if (error.status === 402) return 'Для этой игры нужна подписка Pro.'
    if (error.status === 403) return 'Игра пока закрыта администратором.'
    if (error.status === 429) return 'Лимит запросов исчерпан. Попробуй немного позже.'
    if (error.code === 'game_daily_limit' || error.code === 'ai_budget_reached') return 'Лимит ответов на этот период закончился. Попробуй позже.'
    if (error.code === 'arra_russian_required') return 'Отвечай по-русски. Попробуй ещё раз.'
  }
  return 'Не удалось связаться с собеседником. Проверь соединение и попробуй ещё раз.'
}
