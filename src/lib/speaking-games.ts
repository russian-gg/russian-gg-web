import { api } from './api'
import type { GameSlug } from '../routes/games/speaking/copy'
import type { Companion } from '../routes/games/speaking/visuals'

export interface GameOption { id: string; textRu: string }
export interface GamePrompt { id: string; textRu: string; titleUz: string | null; kind: string; scene: string | null; options: GameOption[] }
export interface GameCriterion { code: string; label: string; passed: boolean; points: number }
export interface GameWord { text: string; category: string; points: number }
export interface GameFeedback {
  answer: string; correct: boolean | null; points: number; explanation: string; correctAnswer: string | null
  criteria: GameCriterion[]; words: GameWord[]; characterPhrase: string; evaluationKind: string
}
export interface GameTurn { roundIndex: number; prompt: GamePrompt; feedback: GameFeedback; answeredAt: string; locationId: string | null }
export interface GameClue { id: string; textRu: string; locationId: string }
export interface GameLocation { id: string; titleRu: string; character: string; characterNameRu: string; questionsAsked: number; maxQuestions: number; visited: boolean }
export interface GameAchievement { code: string; titleRu: string; reward: number; unlockedAt: string }
export interface GameSummary {
  score: number; bestScore: number; isNewBest: boolean; correctAnswers: number; roundsPlayed: number; won: boolean | null
  rewardPoints: number; dailyReward: number; cityPoints: number; cityObjects: string[]
}
export interface GameCommand { requestId: string; expectedVersion: number; locationId?: string }
export interface GameAnswer extends GameCommand { text: string; action: string; suspectId?: string }
export interface GameSession {
  id: string; gameSlug: GameSlug; version: number; status: string; character: Companion; level: string
  score: number; roundIndex: number; totalRounds: number; durationSeconds: number; roundStartedAt: string | null
  deadlineUtc: string | null; serverNowUtc: string; prompt: GamePrompt; feedback: GameFeedback | null; history: GameTurn[]
  clues: GameClue[]; locations: GameLocation[]; achievements: GameAchievement[]; summary: GameSummary | null
  availableActions: string[]; pendingAnswer: GameAnswer | null
}
export interface GameTheme { id: string; titleRu: string; titleUz: string; level: string }
export interface SpeakingGame {
  slug: GameSlug; titleRu: string; titleUz: string; descriptionRu: string; isEnabled: boolean; isAccessible: boolean
  lockReason: string | null; durationSeconds: number; totalRounds: number; levels: string[]; themes: GameTheme[]
}
export interface GameDashboard {
  cityPoints: number; cityObjects: string[]; dailyStreak: number; achievements: GameAchievement[]; bestScores: Record<string, number>
  sessionsPlayed: number; activeSessions: { id: string; gameSlug: GameSlug; status: string }[]
  dailyChallenges: { gameSlug: GameSlug; completed: number; target: number; reward: number }[]
}
export interface LeaderboardEntry { rank: number; displayName: string; score: number; durationSeconds: number; isCurrentUser: boolean }
export interface StartGame {
  requestId: string; character: Companion; level: string; rounds: number; themeId?: string
}

const root = '/speaking-games'
export const speakingGames = {
  catalog: () => api.get<SpeakingGame[]>(`${root}/catalog`),
  dashboard: () => api.get<GameDashboard>(`${root}/dashboard`),
  leaderboard: (slug: GameSlug, weekly = true) => api.get<LeaderboardEntry[]>(`${root}/${slug}/leaderboard?period=${weekly ? 'weekly' : 'all'}`),
  start: (slug: GameSlug, body: StartGame) => api.post<GameSession>(`${root}/${slug}/start`, body),
  session: (slug: GameSlug, id: string) => api.get<GameSession>(`${root}/${slug}/${id}`),
  command: (slug: GameSlug, id: string, command: string, body: GameCommand) => api.post<GameSession>(`${root}/${slug}/${id}/${command}`, body),
  answer: (slug: GameSlug, id: string, body: GameAnswer) => api.post<GameSession>(`${root}/${slug}/${id}/answer`, body),
  audio: (slug: GameSlug, id: string, target: 'prompt' | 'feedback') => api.postBlob(`${root}/${slug}/${id}/tts`, { target }),
}
