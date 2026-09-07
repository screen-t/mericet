const REQUEST_TIMEOUT_MS = 4000;

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchBackendJson<T>(path: string): Promise<T> {
  // Deliberately NOT the client's VITE_BACKEND_URL — that's inlined into the
  // browser bundle at build time and doesn't exist in this server-side edge
  // runtime. This must be configured separately in the Vercel dashboard.
  const baseUrl = process.env.BACKEND_API_URL;
  if (!baseUrl) {
    throw new Error("BACKEND_API_URL is not configured");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new BackendError(res.status, `Backend request to ${path} failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export interface ProfileData {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  bio?: string | null;
  current_position?: string | null;
  current_company?: string | null;
  avatar_url?: string | null;
  suspended_at?: string | null;
}

export interface PostAuthor {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

export interface PostMedia {
  url: string;
  media_type: string;
  thumbnail_url?: string | null;
}

export interface PostData {
  id: string;
  content: string;
  author?: PostAuthor | null;
  media?: PostMedia[] | null;
}

export function getProfile(username: string): Promise<ProfileData> {
  return fetchBackendJson<ProfileData>(`/profile/${encodeURIComponent(username)}`);
}

export function getPost(postId: string): Promise<PostData> {
  return fetchBackendJson<PostData>(`/posts/${encodeURIComponent(postId)}`);
}
