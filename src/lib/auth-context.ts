import { createContext, useContext } from 'react'
import type { PhoneCodeChallenge, UserProfile } from './types'

export interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isPendingOnboarding: boolean
  signIn: (email: string, password: string) => Promise<UserProfile>
  signUp: (email: string, password: string, displayName?: string) => Promise<UserProfile>
  signInWithGoogle: (credential: string, displayName?: string) => Promise<UserProfile>
  /** Primary sign-in: send a one-time code to a phone, then verify it. */
  requestPhoneCode: (phoneNumber: string) => Promise<PhoneCodeChallenge>
  verifyPhoneCode: (phoneNumber: string, code: string, displayName?: string) => Promise<UserProfile>
  /** Attach a phone to the signed-in account (the Google → phone migration). */
  requestPhoneLink: (phoneNumber: string) => Promise<PhoneCodeChallenge>
  verifyPhoneLink: (phoneNumber: string, code: string) => Promise<UserProfile>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  completePendingOnboarding: () => Promise<void>
  abandonPendingOnboarding: () => void
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
