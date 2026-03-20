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

    // Supabase v2 uses PKCE by default: the code in the URL query params is
    // exchanged asynchronously. We must NOT rely on getSession() racing against
    // that exchange — instead we subscribe first, then fall back to getSession()
    // for the case where the exchange already finished before we subscribed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        storeAndRedirect(session)
      }
    })

    // Fallback: check if Supabase already completed the exchange before we subscribed
    supabase.auth.getSession().then(({ data, error }) => {
      if (!redirected && !error && data.session?.access_token) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        storeAndRedirect(data.session)
      }
    })

    // Safety net: if neither path fires within 10 s, bail out
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
