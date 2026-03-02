import { Check, X, Loader2 } from "lucide-react"

interface UsernameStatusProps {
  isChecking: boolean
  isAvailable: boolean | null
  error: string | null
  username: string
}

export const UsernameStatus = ({
  isChecking,
  isAvailable,
  error,
  username,
}: UsernameStatusProps) => {
  // Handle the case where username is too short
  if (!username || username.length < 3) {
    return (
      <p className="text-xs text-muted-foreground">
        Username must be at least 3 characters
      </p>
    )
  }

  // Handle the checking state
  if (isChecking) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking availability...
      </div>
    )
  }

  // Handle errors
  if (error) {
    return (
      <div className="flex items-center gap-1 text-xs text-orange-600">
        <X className="h-3 w-3" />
        {error}
      </div>
    )
  }

  // Handle availability when true
  if (isAvailable === true) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" />
        Username is available!
      </div>
    )
  }

  // Handle availability when false
  if (isAvailable === false) {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600">
        <X className="h-3 w-3" />
        Username is already taken
      </div>
    )
  }

  // Fallback if none of the conditions match
  return null
}