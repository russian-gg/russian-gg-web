import { createContext, useContext } from 'react'
import type { PhoneCodeChallenge, PhoneVerificationChallenge, UserProfile } from './types'

export interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isPendingOnboarding: boolean
  signIn: (identifier: string, password: string) => Promise<UserProfile>
  signUp: (email: string, password: string, displayName?: string) => Promise<UserProfile>
  signInWithGoogle: (credential: string, displayName?: string) => Promise<UserProfile>
  /** One-time phone registration or legacy credential setup. */
  requestPhoneCode: (phoneNumber: string) => Promise<PhoneCodeChallenge>
  confirmPhoneCode: (phoneNumber: string, code: string) => Promise<PhoneVerificationChallenge>
  completePhoneRegistration: (
    verificationToken: string,
    displayName: string,
    password: string,
  ) => Promise<UserProfile>
  /** Attach a phone and reusable password to the signed-in account. */
  requestPhoneLink: (phoneNumber: string) => Promise<PhoneCodeChallenge>
  confirmPhoneLinkCode: (phoneNumber: string, code: string) => Promise<PhoneVerificationChallenge>
  completePhoneLink: (
    verificationToken: string,
    displayName: string,
    password: string,
  ) => Promise<UserProfile>
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
