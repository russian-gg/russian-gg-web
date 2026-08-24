import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, tokenStore } from './api'
import { AuthContext, type AuthState } from './auth-context'
import { disableGoogleAutoSelect } from './google-auth'
import { useLocale } from './i18n'
import type { AuthResponse, PhoneCodeChallenge, UserProfile } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { locale, adoptAccountLocale } = useLocale()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isPendingOnboarding, setPendingOnboarding] = useState(tokenStore.hasPending())

  const loadUser = useCallback(async () => {
    if (!tokenStore.access()) {
      setUser(null)
      setPendingOnboarding(false)
      setLoading(false)
      return
    }

    try {
      const profile = await api.get<UserProfile>('/auth/me')
      adoptAccountLocale(profile.uiLanguage)
      setUser(profile)
      setPendingOnboarding(tokenStore.hasPending())
    } catch {
      // An unusable token is the same as no session; the client should not sit in a
      // half-signed-in state.
      tokenStore.clear()
      setUser(null)
      setPendingOnboarding(false)
    } finally {
      setLoading(false)
    }
  }, [adoptAccountLocale])

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  /**
   * Every cached query belongs to whoever was signed in when it was fetched. Identity is
   * changing, so the cache has to go with it — otherwise the next account is served the
   * previous one's entitlement, progress and home screen straight from memory, and a Free
   * learner is shown Pro until the entry happens to go stale.
   *
   * Called synchronously before `setUser`, so it lands before the re-render mounts any
   * query under the new token.
   */
  const resetCache = useCallback(() => queryClient.clear(), [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isPendingOnboarding,
      async signIn(email, password) {
        const auth = await api.post<AuthResponse>('/auth/login', { email, password })
        tokenStore.set(auth)
        resetCache()
        adoptAccountLocale(auth.user.uiLanguage)
        setUser(auth.user)
        setPendingOnboarding(false)
        return auth.user
      },
      async signUp(email, password, displayName) {
        const auth = await api.post<AuthResponse>('/auth/register', {
          email,
          password,
          displayName,
          timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // The language actually on screen, not an assumption: whoever switched before
          // registering meant it, and the account should be created that way.
          uiLanguage: locale,
        })
        tokenStore.setPending(auth)
        resetCache()
        setUser(auth.user)
        setPendingOnboarding(true)
        return auth.user
      },
      async signInWithGoogle(credential, displayName) {
        const auth = await api.post<AuthResponse>('/auth/google', {
          credential,
          displayName,
          timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiLanguage: locale,
        })
        // Real tokens even for a brand-new account: a learner who abandons onboarding is sent
        // back to it by the public-route redirect, so nothing is lost by committing the session.
        tokenStore.set(auth)
        resetCache()
        adoptAccountLocale(auth.user.uiLanguage)
        setUser(auth.user)
        setPendingOnboarding(false)
        return auth.user
      },
      requestPhoneCode(phoneNumber) {
        return api.post<PhoneCodeChallenge>('/auth/otp/request', {
          phoneNumber,
          timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiLanguage: locale,
        })
      },
      async verifyPhoneCode(phoneNumber, code, displayName) {
        const auth = await api.post<AuthResponse>('/auth/otp/verify', {
          phoneNumber,
          code,
          displayName,
          timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiLanguage: locale,
        })
        tokenStore.set(auth)
        resetCache()
        adoptAccountLocale(auth.user.uiLanguage)
        setUser(auth.user)
        setPendingOnboarding(false)
        return auth.user
      },
      requestPhoneLink(phoneNumber) {
        return api.post<PhoneCodeChallenge>('/auth/phone/link/request', { phoneNumber })
      },
      // Confirms the phone for the account already signed in. The caller signs out straight
      // after — the learner then comes back in through the phone door — so the session is left
      // untouched here rather than refreshed.
      verifyPhoneLink(phoneNumber, code) {
        return api.post<UserProfile>('/auth/phone/link/verify', { phoneNumber, code })
      },
      async signOut() {
        const refreshToken = tokenStore.refresh()
        if (refreshToken) {
          // Best effort: revoke server-side, but always clear locally.
          await api.post('/auth/logout', { refreshToken }).catch(() => {})
        }
        disableGoogleAutoSelect()
        tokenStore.clear()
        resetCache()
        setUser(null)
        setPendingOnboarding(false)
      },
      async completePendingOnboarding() {
        tokenStore.promotePending()
        setPendingOnboarding(false)
        await loadUser()
      },
      abandonPendingOnboarding() {
        tokenStore.clear()
        resetCache()
        setUser(null)
        setPendingOnboarding(false)
      },
      refreshUser: loadUser,
    }),
    [user, isLoading, isPendingOnboarding, loadUser, resetCache, locale, adoptAccountLocale],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
