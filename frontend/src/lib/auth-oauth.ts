import { supabase, isSupabaseConfigured } from "./supabase.ts";

export interface OAuthOptions {
  redirectTo?: string;
  queryParams?: Record<string, string>;
  scopes?: string;
}

export const MISSING_OAUTH_CONFIG_MESSAGE =
  "Google Authentication is not configured. Missing valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend configuration. Please configure your Supabase project in frontend/.env to enable OAuth.";

/**
 * Validates Supabase configuration and initiates Google OAuth sign-in.
 * Guaranteed never to redirect to a placeholder or invalid domain.
 */
export async function initiateGoogleOAuth(options: OAuthOptions = {}): Promise<{ url?: string | null }> {
  if (!isSupabaseConfigured()) {
    throw new Error(MISSING_OAUTH_CONFIG_MESSAGE);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  const callbackUrl = options.redirectTo || `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      queryParams: options.queryParams,
      scopes: options.scopes,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to initiate Google sign-in.");
  }

  return data;
}

/**
 * Validates Supabase configuration and initiates GitHub OAuth sign-in.
 */
export async function initiateGithubOAuth(options: OAuthOptions = {}): Promise<{ url?: string | null }> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "GitHub Authentication is not configured. Missing valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend configuration."
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  const callbackUrl = options.redirectTo || `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: callbackUrl,
      queryParams: options.queryParams,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to initiate GitHub sign-in.");
  }

  return data;
}

/**
 * Validates Supabase configuration and initiates LinkedIn OAuth sign-in.
 */
export async function initiateLinkedinOAuth(options: OAuthOptions = {}): Promise<{ url?: string | null }> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "LinkedIn Authentication is not configured. Missing valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend configuration."
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  const callbackUrl = options.redirectTo || `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: {
      redirectTo: callbackUrl,
      queryParams: options.queryParams,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to initiate LinkedIn sign-in.");
  }

  return data;
}
