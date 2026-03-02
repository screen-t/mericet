import { useState, useEffect } from "react"
import { authApi } from "@/lib/api"

interface UseUsernameCheckResult {
  isChecking: boolean
  isAvailable: boolean | null
  error: string | null
}

export const useUsernameCheck = (username: string, debounceMs: number = 500): UseUsernameCheckResult => {
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setIsAvailable(null)

    if (!username || username.length < 3) {
      setIsChecking(false)
      return
    }

    setIsChecking(true)

    const timeoutId = setTimeout(async () => {
      try {
        const result = await authApi.checkUsername(username)
        setIsAvailable(result.available)
        setError(null)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Failed to check username")
        }
        setIsAvailable(null)
      } finally {
        setIsChecking(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timeoutId)
      setIsChecking(false)
    }
  }, [username, debounceMs])

  return {
    isChecking,
    isAvailable,
    error
  }
}