import { api } from '../../../lib/api'
import type { VoiceSessionTicket } from '../../../lib/types'

export type LifeCharacter = 'penguin' | 'panda' | 'pero'
export type LifeTopic = { id: string; title: string; level: string; mode: 'debate' | 'monologue'; opening?: string }
export type LifeCatalog = { isEnabled: boolean; isAccessible: boolean; lockReason: string | null; topics: LifeTopic[] }
export type LifeView = {
  id: string; status: 'ready' | 'connecting' | 'playing' | 'completed'; character: LifeCharacter
  level: string; topic: LifeTopic; score: number; speechMilliseconds: number; silenceMilliseconds: number
  serverNowUtc: string; deadlineUtc?: string; outcome?: 'won' | 'silence' | 'stopped'; transcript: string
}
export type LifeActivity = {
  sequence: number; speechMilliseconds: number; speaking: boolean; tutorSpeaking: boolean; transcript: string; finish: boolean
  silenceMilliseconds?: number
}
const path = (id: string) => `/fight-for-life/sessions/${id}`
export const lifeApi = {
  catalog: () => api.get<LifeCatalog>('/fight-for-life/catalog'),
  start: (character: LifeCharacter, level: string, topicId: string) =>
    api.post<LifeView>('/fight-for-life/sessions', { requestId: crypto.randomUUID(), character, level, topicId }),
  voice: (id: string) => api.post<VoiceSessionTicket>(`${path(id)}/voice`, {}),
  begin: (id: string) => api.post<LifeView>(`${path(id)}/begin`, {}),
  get: (id: string) => api.get<LifeView>(path(id)),
  activity: (id: string, body: LifeActivity) => api.post<LifeView>(`${path(id)}/activity`, body),
  leave: (id: string, body: LifeActivity) => api.postOnExit(`${path(id)}/activity`, { ...body, finish: true }),
}
