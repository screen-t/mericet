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
    // Attempt to restore session
    (async () => {
      const tokens = getStoredTokens()
      if (tokens.access_token && tokens.refresh_token) {
        try {
          // Use setSession so the Supabase client has full session context
          // (required for refreshSession to work later)
          const { supabase } = await import('./supabase')
          const { data, error } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          })
          if (error || !data.session) throw error
          // Persist the (possibly refreshed) tokens
          setStoredTokens(data.session)
          const me = await authApi.me(data.session.access_token)
          setUser(me)
        } catch (e) {
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

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshSession }}>
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

  if (loading) return null

  // Not authenticated -> redirect to /login and preserve return path
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return children
}
