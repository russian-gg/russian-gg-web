import { createContext, useContext } from 'react'
import type { UserProfile } from './types'

export interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<UserProfile>
  signUp: (email: string, password: string, displayName?: string) => Promise<UserProfile>
  signInWithGoogle: (credential: string, displayName?: string) => Promise<UserProfile>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

/**
 * Context and hook live apart from the provider component so the module that screens import
 * exports no components — that is what keeps fast refresh working across the whole app.
 */
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
