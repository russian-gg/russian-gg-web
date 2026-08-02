import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore } from './api'
import { AuthContext, type AuthState } from './auth-context'
import { disableGoogleAutoSelect } from './google-auth'
import type { AuthResponse, UserProfile } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
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
      setUser(await api.get<UserProfile>('/auth/me'))
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
  }, [])

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isPendingOnboarding,
      async signIn(email, password) {
        const auth = await api.post<AuthResponse>('/auth/login', { email, password })
        tokenStore.set(auth)
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
          uiLanguage: 'uz',
        })
        tokenStore.setPending(auth)
        setUser(auth.user)
        setPendingOnboarding(true)
        return auth.user
      },
      async signInWithGoogle(credential, displayName, options) {
        const auth = await api.post<AuthResponse>('/auth/google', {
          credential,
          displayName,
          timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiLanguage: 'uz',
        })
        if (options?.pendingOnboarding && !auth.user.hasCompletedDiagnostic) {
          tokenStore.setPending(auth)
          setPendingOnboarding(true)
        } else {
          tokenStore.set(auth)
          setPendingOnboarding(false)
        }
        setUser(auth.user)
        return auth.user
      },
      async signOut() {
        const refreshToken = tokenStore.refresh()
        if (refreshToken) {
          // Best effort: revoke server-side, but always clear locally.
          await api.post('/auth/logout', { refreshToken }).catch(() => {})
        }
        disableGoogleAutoSelect()
        tokenStore.clear()
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
        setUser(null)
        setPendingOnboarding(false)
      },
      refreshUser: loadUser,
    }),
    [user, isLoading, isPendingOnboarding, loadUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
