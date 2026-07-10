import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api"

async function resolveDestination(accessToken: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return "/feed"
    const profile = await res.json()
    // Placeholder username pattern set by _ensure_user_exists: "user_" + 8 hex chars
    const isNew = !profile.username || /^user_[0-9a-f]{8}$/i.test(profile.username)
    return isNew ? "/onboarding" : "/feed"
  } catch {
    return "/feed"
  }
}

export default function OAuthCallback() {
  useEffect(() => {
    let redirected = false

    async function storeAndRedirect(session: { access_token: string; refresh_token?: string | null }) {
      if (redirected) return
      redirected = true
      localStorage.setItem("access_token", session.access_token)
      if (session.refresh_token) {
        localStorage.setItem("refresh_token", session.refresh_token)
      }
      const destination = await resolveDestination(session.access_token)
      window.location.replace(destination)
    }

    // Path 1: backend OAuth callback passes tokens as query params
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    if (accessToken) {
      storeAndRedirect({ access_token: accessToken, refresh_token: refreshToken })
      return
    }

    // Path 2: Supabase PKCE flow — subscribe before getSession() to avoid a race
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
