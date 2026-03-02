import { supabase } from './supabase'
import { User } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// --- Type for signup payload ---
export interface SignupData {
  email: string
  password: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface SignupPayload {
  email: string
  password: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface SignupResponse {
  user: User
  session: {
    access_token: string
    refresh_token: string
  }
}

// --- Type for signup response ---
interface AuthResponse {
  user: any
  session: any
}

export const authApi = {
  me: async (accessToken?: string) => {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    if (error) throw new Error(error.message)
    if (!user) throw new Error('User not found')

    try {
      const response = await fetch(`${API_BASE_URL}/profile/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken || localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const profile = await response.json()
        return profile
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e)
    }

    return {
      id: user.id,
      email: user.email || '',
      username: user.user_metadata?.username || user.email?.split('@')[0] || '',
      first_name: user.user_metadata?.first_name || '',
      last_name: user.user_metadata?.last_name || '',
      avatar_url: user.user_metadata?.avatar_url || undefined,
      email_visible: false,
      account_type: 'personal' as const,
      created_at: user.created_at || '',
      updated_at: user.updated_at || ''
    }
  },

  refresh: async (data: { refresh_token: string }) => {
    const { data: authData, error } = await supabase.auth.refreshSession({
      refresh_token: data.refresh_token
    })
    if (error) throw new Error(error.message)
    return { session: authData.session, user: authData.user }
  },

  login: async (data: { email: string; password: string }) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword(data)
    if (error) throw new Error(error.message)
    return { user: authData.user, session: authData.session }
  },

  signup: async (data: SignupData): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        username: data.username ?? data.email.split('@')[0],
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? ''
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Signup failed' }))
      throw new Error(err.detail || 'Signup failed')
    }

    const result = await response.json()
    return { user: result.user, session: result.session }
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    return { success: true }
  },

  googleOAuth: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) throw new Error(error.message)
    return data
  },

  githubOAuth: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) throw new Error(error.message)
    return data
  },

  linkedinOAuth: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) throw new Error(error.message)
    return data
  },

  checkUsername: async (username: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error('Failed to check username availability')
    }

    return { available: !data, username }
  },

  forgotPassword: async (data: { email: string }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw new Error(error.message)
    return { success: true, message: 'Password reset email sent' }
  },

  resetPassword: async (data: { access_token: string; new_password: string }) => {
    const { error } = await supabase.auth.updateUser({ password: data.new_password })
    if (error) throw new Error(error.message)
    return { success: true, message: 'Password updated successfully' }
  }
}