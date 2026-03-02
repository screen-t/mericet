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
    // Reset states when username changes
    setError(null)
    setIsAvailable(null)

    // Don't check if username is too short
    if (!username || username.length < 3) {
      setIsChecking(false)
      return
    }

    // Start checking indicator
    setIsChecking(true)

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      try {
        const result = await authApi.checkUsername(username)
        setIsAvailable(result.available)
        setError(null)
      } catch (err: any) {
        setError(err.message || "Failed to check username")
        setIsAvailable(null)
      } finally {
        setIsChecking(false)
      }
    }, debounceMs)

    // Cleanup timeout on cleanup or when username changes
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