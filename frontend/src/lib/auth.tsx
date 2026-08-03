import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from './api'
import type { SignupPayload } from './api'
import { User } from '@/types/api'
import { AuthContext, AuthContextValue, SavedAccount } from './auth-context'

type Session = {
  access_token?: string
  refresh_token?: string
}

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const SAVED_ACCOUNTS_KEY = 'saved_accounts'

function getSavedAccounts(): SavedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]')
  } catch {
    return []
  }
}

function setSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts))
}

function saveCurrentAccount(user: User, tokens: Session) {
  if (!user?.id || !tokens.access_token) return
  const accounts = getSavedAccounts()
  const updated = accounts.filter(a => a.id !== user.id)
  updated.unshift({
    id: user.id,
    email: user.email,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar_url: user.avatar_url,
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token!,
  })
  setSavedAccounts(updated)
}

function removeSavedAccount(accountId: string) {
  setSavedAccounts(getSavedAccounts().filter(a => a.id !== accountId))
}

function getStoredTokens(): Session {
  return {
    access_token:
      localStorage.getItem(ACCESS_TOKEN_KEY) ||
      sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
      undefined,
    refresh_token:
      localStorage.getItem(REFRESH_TOKEN_KEY) ||
      sessionStorage.getItem(REFRESH_TOKEN_KEY) ||
      undefined,
  }
}

function setStoredTokens(session?: Session, persist = true) {
  if (!session) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    return
  }
  const storage = persist ? localStorage : sessionStorage
  if (session.access_token) storage.setItem(ACCESS_TOKEN_KEY, session.access_token)
  if (session.refresh_token) storage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedAccounts, setSavedAccountsState] = useState<SavedAccount[]>(getSavedAccounts)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const tokens = getStoredTokens()
      if (tokens.access_token) {
        // Snapshot the token so we can detect if login() ran concurrently and
        // stored new tokens before this restore finishes — if so, bail out.
        const startToken = tokens.access_token
        let networkFail = false
        try {
          let me: User | null = null
          try {
            me = await authApi.me(tokens.access_token)
          } catch (err) {
            if (err instanceof TypeError) {
              // Network error — backend is cold-starting. Keep the session alive
              // so the user isn't logged out just because Render is waking up.
              networkFail = true
            } else {
              // HTTP error (likely 401) — try to get a fresh token before giving up.
              try {
                const { supabase } = await import('./supabase')
                const { data } = await supabase.auth.getSession()
                if (data.session?.access_token) {
                  setStoredTokens({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token ?? undefined,
                  })
                  me = await authApi.me(data.session.access_token)
                }
              } catch { /* fall through to backend refresh */ }

              if (!me && tokens.refresh_token) {
                try {
                  const refreshed = await authApi.refresh({ refresh_token: tokens.refresh_token })
                  if (refreshed.session) {
                    setStoredTokens(refreshed.session)
                    me = await authApi.me(refreshed.session.access_token)
                  }
                } catch { /* all refresh paths exhausted */ }
              }
            }
          }

          // If login() ran while we were awaiting, the stored token has changed.
          // Don't clobber the new session — just leave everything as login() left it.
          if (cancelled || getStoredTokens().access_token !== startToken) return

          if (me) setUser(me)
          else if (!networkFail) setStoredTokens(undefined)
        } catch {
          if (cancelled || getStoredTokens().access_token !== startToken) return
          setStoredTokens(undefined)
          setUser(null)
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const login = async (email: string, password: string, rememberMe = false) => {
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      if (res.session) {
        setStoredTokens(res.session, rememberMe)
        const profile = await authApi.me(res.session.access_token)
        setUser(profile)
        if (profile) {
          saveCurrentAccount(profile, res.session)
          setSavedAccountsState(getSavedAccounts())
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (payload: SignupPayload) => {
    setLoading(true)
    try {
      const res = await authApi.signup(payload)
      if (res.session) {
        setStoredTokens(res.session)
        const profile = await authApi.me(res.session.access_token)
        setUser(profile)
        if (profile) {
          saveCurrentAccount(profile, res.session)
          setSavedAccountsState(getSavedAccounts())
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    const tokens = getStoredTokens()
    try {
      await authApi.logout({ refresh_token: tokens.refresh_token })
    } catch {
      // ignore
    }
    // Remove this account from the saved list — its session is now invalid
    if (user) {
      removeSavedAccount(user.id)
      setSavedAccountsState(getSavedAccounts())
    }
    setStoredTokens(undefined)
    setUser(null)
    queryClient.clear()
    navigate('/login')
  }

  const refreshSession = async () => {
    const tokens = getStoredTokens()
    if (!tokens.refresh_token) throw new Error('No refresh token')
    const res = await authApi.refresh({ refresh_token: tokens.refresh_token })
    if (res.session) setStoredTokens(res.session)
  }

  const refreshUser = async () => {
    const tokens = getStoredTokens()
    if (!tokens.access_token) {
      setUser(null)
      return
    }
    const profile = await authApi.me(tokens.access_token)
    setUser(profile)
  }

  const switchAccount = async (account: SavedAccount) => {
    setLoading(true)
    try {
      if (user) {
        saveCurrentAccount(user, getStoredTokens())
      }
      setStoredTokens({ access_token: account.access_token, refresh_token: account.refresh_token })
      queryClient.clear()
      try {
        const profile = await authApi.me(account.access_token)
        setUser(profile)
        if (profile) {
          saveCurrentAccount(profile, { access_token: account.access_token, refresh_token: account.refresh_token })
          setSavedAccountsState(getSavedAccounts())
        }
      } catch {
        const refreshed = await authApi.refresh({ refresh_token: account.refresh_token })
        if (refreshed.session) {
          setStoredTokens(refreshed.session)
          const profile = await authApi.me(refreshed.session.access_token)
          setUser(profile)
          if (profile) {
            saveCurrentAccount(profile, refreshed.session)
            setSavedAccountsState(getSavedAccounts())
          }
        }
      }
      navigate('/feed')
    } catch {
      removeSavedAccount(account.id)
      setSavedAccountsState(getSavedAccounts())
    } finally {
      setLoading(false)
    }
  }

  const removeAccountHandler = (accountId: string) => {
    removeSavedAccount(accountId)
    setSavedAccountsState(getSavedAccounts())
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshSession, refreshUser, savedAccounts, switchAccount, removeAccount: removeAccountHandler }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // While the AuthProvider is resolving the stored token, render nothing.
  // Never redirect during loading — this is what causes the "sometimes lands
  // on login page" bug after an OAuth redirect (the backend call races the render).
  if (loading) return null

  // Not authenticated -> redirect to /login and preserve return path
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return children
}
