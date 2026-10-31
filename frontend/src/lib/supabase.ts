import { createClient } from "@supabase/supabase-js";

export const rawSupabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
  "";
export const rawSupabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
  "";

/**
 * Returns true if real, non-placeholder Supabase credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  if (!rawSupabaseUrl || !rawSupabaseAnonKey) return false;
  const urlLower = rawSupabaseUrl.toLowerCase();
  const keyLower = rawSupabaseAnonKey.toLowerCase();
  return !(
    urlLower.includes("placeholder-project") ||
    urlLower.includes("your-project-id") ||
    keyLower.includes("placeholder-anon-key") ||
    keyLower.includes("your-anon-key")
  );
}

const supabaseUrl = isSupabaseConfigured()
  ? rawSupabaseUrl
  : "https://placeholder-project.supabase.co";

const supabaseAnonKey = isSupabaseConfigured()
  ? rawSupabaseAnonKey
  : "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

