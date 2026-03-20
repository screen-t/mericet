import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { authApi } from './api'
import { User } from '@/types/api'
import { AuthContext, AuthContextValue } from './auth-context'

type Session = {
  access_token?: string
  refresh_token?: string
}

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

function getStoredTokens(): Session {
  return {
    access_token: localStorage.getItem(ACCESS_TOKEN_KEY) || undefined,
    refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY) || undefined,
  }
}

function setStoredTokens(session?: Session) {
  if (!session) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    return
  }
  if (session.access_token) localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token)
  if (session.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Attempt to restore session using stored tokens — no Supabase client needed
    (async () => {
      const tokens = getStoredTokens()
      if (tokens.access_token) {
        try {
          let me: User | null = null
          try {
            // Try with stored access token
            me = await authApi.me(tokens.access_token)
          } catch {
            // Token may be expired — try refreshing via backend
            if (tokens.refresh_token) {
              const refreshed = await authApi.refresh({ refresh_token: tokens.refresh_token })
              if (refreshed.session) {
                setStoredTokens(refreshed.session)
                me = await authApi.me(refreshed.session.access_token)
              }
            }
          }
          if (me) setUser(me)
          else setStoredTokens(undefined)
        } catch {
          setStoredTokens(undefined)
          setUser(null)
        }
      }
      setLoading(false)
    })()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      if (res.session) {
        setStoredTokens(res.session)
        // Fetch full user profile
        const profile = await authApi.me(res.session.access_token)
        setUser(profile)
      }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (payload: any) => {
    setLoading(true)
    try {
      const res = await authApi.signup(payload)
      if (res.session) {
        setStoredTokens(res.session)
        // Fetch full user profile
        const profile = await authApi.me(res.session.access_token)
        setUser(profile)
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    const tokens = getStoredTokens()
    try {
      await authApi.logout({ refresh_token: tokens.refresh_token })
    } catch (e) {
      // ignore
    }
    setStoredTokens(undefined)
    setUser(null)
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

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshSession, refreshUser }}>
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
