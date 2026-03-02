import React, { useContext, useEffect, useState } from "react"
import { useNavigate, Navigate, useLocation } from "react-router-dom"

import { authApi } from "./api"
import { AuthContext, AuthContextValue } from "./auth-context"
import { User } from "@/types/api"

import {SignupPayload, SignupResponse } from "@/lib/api"

type Session = {
  access_token?: string
  refresh_token?: string
}

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

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

  if (session.access_token)
    localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token)

  if (session.refresh_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)

}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null)

  const [loading, setLoading] = useState(true)

  const navigate = useNavigate()

  useEffect(() => {

    const init = async () => {

      try {

        const tokens = getStoredTokens()

        if (!tokens.access_token || !tokens.refresh_token) {
          setLoading(false)
          return
        }

        const { supabase } = await import("./supabase")

        const { data, error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })

        if (error || !data.session)
          throw error

        setStoredTokens(data.session)

        const profile = await authApi.me(data.session.access_token)

        setUser(profile)

      }
      catch {

        setStoredTokens(undefined)

        setUser(null)

      }
      finally {

        setLoading(false)

      }

    }

    init()

  }, [])



  const login = async (email: string, password: string): Promise<void> => {

    setLoading(true)

    try {

      const res = await authApi.login({ email, password })

      if (!res.session?.access_token)
        throw new Error("Login failed")

      setStoredTokens(res.session)

      const profile = await authApi.me(res.session.access_token)

      setUser(profile)

    }
    finally {

      setLoading(false)

    }

  }



  const signup = async (payload: SignupPayload): Promise<SignupResponse> => {

    setLoading(true)

    try {

      const res = await authApi.signup(payload)

      if (!res.session?.access_token)
        throw new Error("Signup failed")

      setStoredTokens(res.session)

      const profile = await authApi.me(res.session.access_token)

      setUser(profile)

      return res   // CRITICAL FIX

    }
    finally {

      setLoading(false)

    }

  }



  const logout = async (): Promise<void> => {

    try {

      await authApi.logout()

    }
    finally {

      setStoredTokens(undefined)

      setUser(null)

      navigate("/login")

    }

  }



  const refreshSession = async (): Promise<void> => {

    const tokens = getStoredTokens()

    if (!tokens.refresh_token)
      throw new Error("No refresh token")

    const res = await authApi.refresh({
      refresh_token: tokens.refresh_token
    })

    if (res.session)
      setStoredTokens(res.session)

  }



  const value: AuthContextValue = {

    user,

    loading,

    login,

    signup,

    logout,

    refreshSession

  }



  return (

    <AuthContext.Provider value={value}>

      {children}

    </AuthContext.Provider>

  )

}



export function useAuth() {

  const ctx = useContext(AuthContext)

  if (!ctx)
    throw new Error("useAuth must be used within AuthProvider")

  return ctx

}



export const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {

  const { user, loading } = useAuth()

  const location = useLocation()

  if (loading)
    return null

  if (!user)
    return <Navigate to="/login" replace state={{ from: location }} />

  return children

}