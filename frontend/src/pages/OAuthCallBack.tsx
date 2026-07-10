import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function OAuthCallback() {
  useEffect(() => {
    let redirected = false

    function storeAndRedirect(session: { access_token: string; refresh_token?: string | null }) {
      if (redirected) return
      redirected = true
      localStorage.setItem("access_token", session.access_token)
      if (session.refresh_token) {
        localStorage.setItem("refresh_token", session.refresh_token)
      }
      window.location.replace("/feed")
    }

    // Path 1: backend OAuth callback passes tokens as query params
    // (?access_token=...&refresh_token=...)
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    if (accessToken) {
      storeAndRedirect({ access_token: accessToken, refresh_token: refreshToken })
      return
    }

    // Path 2: Supabase PKCE flow — code is exchanged asynchronously.
    // Subscribe before calling getSession() to avoid a race.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        storeAndRedirect(session)
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!redirected && !error && data.session?.access_token) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        storeAndRedirect(data.session)
      }
    })

    const timeout = setTimeout(() => {
      if (!redirected) {
        redirected = true
        subscription.unsubscribe()
        window.location.replace("/login?error=oauth_timeout")
      }
    }, 10_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return <p>Completing authentication…</p>
}
