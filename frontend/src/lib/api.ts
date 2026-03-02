/**
 * Auth API — all calls routed through the FastAPI backend.
 * No direct Supabase client calls, so users in regions where supabase.co is
 * blocked (e.g. India) can still use email/password auth and session management.
 *
 * NOTE: OAuth (Google / GitHub / LinkedIn) still redirects through Supabase's
 * OAuth URL and will not work where supabase.co is blocked. Email/password is
 * the recommended login path for affected regions.
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

async function backendPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

async function backendGet<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') || undefined : undefined);
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

export const authApi = {
  /** Fetch the current user's full profile from the backend. */
  me: async (accessToken?: string) => {
    return backendGet<any>('/profile/me', accessToken);
  },

  /** Refresh the session via the backend (no direct Supabase call). */
  refresh: async (data: { refresh_token: string }) => {
    return backendPost<{ success: boolean; session: any }>('/auth/refresh', {
      refresh_token: data.refresh_token,
    });
  },

  /** Email + password login via backend. */
  login: async (data: { email: string; password: string }) => {
    return backendPost<{ success: boolean; user: any; session: any }>('/auth/login', data);
  },

  /** Register a new user via backend. */
  signup: async (data: any) => {
    return backendPost<{ success: boolean; user: any; session: any }>('/auth/signup', {
      email: data.email,
      password: data.password,
      username: data.username || data.email.split('@')[0],
      first_name: data.first_name || '',
      last_name: data.last_name || '',
    });
  },

  /** Sign out — notifies backend to clear session. */
  logout: async (data?: { refresh_token?: string }) => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') || undefined : undefined;
    await backendPost('/auth/logout', { refresh_token: data?.refresh_token || null }, token).catch(() => {});
    return { success: true };
  },

  /**
   * OAuth flows — these still redirect through Supabase's OAuth URL.
   * Not available in regions where supabase.co is blocked.
   */
  googleOAuth: async () => {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  githubOAuth: async () => {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  linkedinOAuth: async () => {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Check username availability via backend. */
  checkUsername: async (username: string) => {
    return backendGet<{ available: boolean }>(
      `/auth/check-username?username=${encodeURIComponent(username)}`
    );
  },

  /** Send a password reset email via backend. */
  forgotPassword: async (data: { email: string }) => {
    return backendPost<{ success: boolean; message: string }>('/auth/forgot-password', data);
  },

  /** Reset password via backend. */
  resetPassword: async (data: { access_token: string; new_password: string }) => {
    return backendPost<{ success: boolean; message: string }>('/auth/reset-password', data);
  },
}
