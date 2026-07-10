import { createContext } from 'react'
import { User } from '@/types/api'
import type { SignupPayload } from './api'

export type SavedAccount = {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  avatar_url?: string
  access_token: string
  refresh_token: string
}

export type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  refreshUser: () => Promise<void>
  savedAccounts: SavedAccount[]
  switchAccount: (account: SavedAccount) => Promise<void>
  removeAccount: (accountId: string) => void
}

// Kept in its own file so HMR updates to auth.tsx never recreate this object.
// If the context identity changes between hot reloads, useContext returns undefined
// for all consumers that imported the new context while the Provider still holds the old one.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
