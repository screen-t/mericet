import { createContext } from 'react'
import { User } from '@/types/api'

interface SignupResponse {
  user: User
  session: any
}
interface SignupPayload {
  email: string
  password: string
  username?: string
  first_name?: string
  last_name?: string
}

export type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
signup: (payload: SignupPayload) => Promise<SignupResponse>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

// Kept in its own file so HMR updates to auth.tsx never recreate this object.
// If the context identity changes between hot reloads, useContext returns undefined
// for all consumers that imported the new context while the Provider still holds the old one.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
