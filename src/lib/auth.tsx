import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore } from './api'
import { AuthContext, type AuthState } from './auth-context'
import { disableGoogleAutoSelect } from './google-auth'
import type { AuthResponse, UserProfile } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    if (!tokenStore.access()) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      setUser(await api.get<UserProfile>('/auth/me'))
    } catch {
      // An unusable token is the same as no session; the client should not sit in a
      // half-signed-in state.
      tokenStore.clear()
      setUser(null)
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
      async signIn(email, password) {
        const auth = await api.post<AuthResponse>('/auth/login', { email, password })
        tokenStore.set(auth)
        setUser(auth.user)
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
        tokenStore.set(auth)
        setUser(auth.user)
        return auth.user
      },
      async signInWithGoogle(credential, displayName) {
        const auth = await api.post<AuthResponse>('/auth/google', {
          credential,
          displayName,
          timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiLanguage: 'uz',
        })
        tokenStore.set(auth)
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
      },
      refreshUser: loadUser,
    }),
    [user, isLoading, loadUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
