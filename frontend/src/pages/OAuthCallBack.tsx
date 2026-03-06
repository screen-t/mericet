import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function OAuthCallback() {
  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get the session that Supabase automatically set up after OAuth redirect
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error("Failed to get session:", error)
          window.location.href = "/login?error=oauth_failed"
          return
        }

        const session = data.session
        if (!session?.access_token) {
          console.error("No access token in session")
          window.location.href = "/login?error=oauth_failed"
          return
        }

        // Store tokens in localStorage for our custom auth system
        localStorage.setItem("access_token", session.access_token)
        if (session.refresh_token) {
          localStorage.setItem("refresh_token", session.refresh_token)
        }

        // Reload page to trigger AuthProvider's useEffect with tokens now in localStorage
        // This ensures the user session is properly restored before navigating to /feed
        window.location.href = "/feed"
      } catch (error) {
        console.error("OAuth callback error:", error)
        window.location.href = "/login?error=oauth_failed"
      }
    }

    handleOAuthCallback()
  }, [])

  return <p>Completing authentication…</p>
}
