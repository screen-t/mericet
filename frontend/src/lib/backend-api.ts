/**
 * Client for the Stonet FastAPI backend.
 * All requests use the stored access token (localStorage) for auth.
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

function getAuthHeaders(): HeadersInit {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Singleton refresh promise — prevents multiple concurrent refresh attempts
let refreshingPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    // Route through backend — no direct Supabase call needed
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.session) return null;
    localStorage.setItem(ACCESS_TOKEN_KEY, data.session.access_token);
    if (data.session.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.session.refresh_token);
    }
    return data.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Drop-in replacement for fetch() that automatically refreshes the access
 * token on 401 and retries the original request once.
 * On a second 401 (refresh failed), clears tokens and redirects to /login.
 */
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status !== 401) return res;

  // Deduplicate concurrent refresh calls
  if (!refreshingPromise) {
    refreshingPromise = tryRefreshToken().finally(() => { refreshingPromise = null; });
  }
  const newToken = await refreshingPromise;

  if (!newToken) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.href = "/login";
    return res;
  }

  // Retry with refreshed token
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${newToken}`,
    },
  });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// --- Auth ---
const auth = {
  checkUsername: (username: string): Promise<{ available: boolean }> =>
    fetch(`${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(username)}`)
      .then(handleResponse<{ available: boolean }>),
};

// --- Profile ---
const profile = {
  getMyProfile: () =>
    fetchWithAuth(`${API_BASE_URL}/profile/me`, { headers: getAuthHeaders() }).then(handleResponse),
  getProfile: (username: string) =>
    fetchWithAuth(`${API_BASE_URL}/profile/${encodeURIComponent(username)}`, { headers: getAuthHeaders() }).then(handleResponse),
  updateProfile: (data: Record<string, unknown>) =>
    fetchWithAuth(`${API_BASE_URL}/profile/me`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  addWorkExperience: (data: Record<string, unknown>) =>
    fetchWithAuth(`${API_BASE_URL}/profile/work-experience`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateWorkExperience: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`${API_BASE_URL}/profile/work-experience/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteWorkExperience: (id: string) =>
    fetchWithAuth(`${API_BASE_URL}/profile/work-experience/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  addEducation: (data: Record<string, unknown>) =>
    fetchWithAuth(`${API_BASE_URL}/profile/education`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateEducation: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`${API_BASE_URL}/profile/education/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteEducation: (id: string) =>
    fetchWithAuth(`${API_BASE_URL}/profile/education/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  addSkill: (skillName: string) =>
    fetchWithAuth(`${API_BASE_URL}/profile/skills`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ skill: skillName }),
    }).then(handleResponse),
  deleteSkill: (skillId: string) =>
    fetchWithAuth(`${API_BASE_URL}/profile/skills/${skillId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// --- Posts ---
const posts = {
  getFeed: (feedType: "for_you" | "following", limit: number, offset: number) =>
    fetchWithAuth(
      `${API_BASE_URL}/posts?feed_type=${feedType}&limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<unknown[]>),
  getUserPosts: async (username: string, limit: number, offset: number) => {
    const list = await fetchWithAuth(
      `${API_BASE_URL}/posts/user/${encodeURIComponent(username)}?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<unknown[]>);
    return { posts: Array.isArray(list) ? list : [] };
  },
  createPost: (data: {
    content: string;
    post_type?: string;
    visibility?: string;
    media?: Array<{ url: string; media_type: string; thumbnail_url?: string | null }>;
    poll?: {
      question: string;
      options: Array<{ option_text: string; display_order: number }>;
      ends_at?: string;
    };
    scheduled_at?: string;
    is_draft?: boolean;
  }) =>
    fetchWithAuth(`${API_BASE_URL}/posts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  likePost: (postId: string) =>
    fetchWithAuth(`${API_BASE_URL}/posts/${postId}/like`, {
      method: "POST",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  unlikePost: (postId: string) =>
    fetchWithAuth(`${API_BASE_URL}/posts/${postId}/like`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  addComment: (postId: string, content: string) =>
    fetchWithAuth(`${API_BASE_URL}/posts/${postId}/comments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    }).then(handleResponse),
  repost: (postId: string, comment?: string) =>
    fetchWithAuth(`${API_BASE_URL}/posts/${postId}/repost`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: comment ? JSON.stringify({ comment }) : undefined,
    }).then(handleResponse),
  unrepost: (postId: string) =>
    fetchWithAuth(`${API_BASE_URL}/posts/${postId}/repost`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  getComments: async (postId: string, limit: number, offset: number): Promise<import('@/types/api').CommentsResponse> => {
    const raw = await fetchWithAuth(
      `${API_BASE_URL}/posts/${postId}/comments?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<import('@/types/api').Comment[]>);
    // Backend returns a raw array; wrap to match CommentsResponse shape
    return { comments: Array.isArray(raw) ? raw : [] };
  },
  votePoll: (postId: string, optionId: string) =>
    fetchWithAuth(`${API_BASE_URL}/posts/${postId}/poll/vote`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ option_id: optionId }),
    }).then(handleResponse),
};

// --- Connections ---
const connections = {
  getConnections: (status: string, limit: number, offset: number) =>
    fetchWithAuth(
      `${API_BASE_URL}/connections?status=${status}&limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    ).then(async (res) => {
      const data = await handleResponse<unknown[]>(res);
      const list: any[] = Array.isArray(data) ? data : [];
      return { connections: list };
    }) as Promise<import('@/types/api').ConnectionsResponse>,
  getConnectionStatus: (userId: string) =>
    fetchWithAuth(`${API_BASE_URL}/connections/check/by-id/${encodeURIComponent(userId)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse<{ status: string; connection_id?: string; is_requester?: boolean; can_connect?: boolean }>),
  sendRequest: (receiverId: string) =>
    fetchWithAuth(`${API_BASE_URL}/connections`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ receiver_id: receiverId }),
    }).then(handleResponse),
  respondToRequest: (connectionId: string, accept: boolean) =>
    fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: accept ? "accepted" : "declined" }),
    }).then(handleResponse),
  removeConnection: (connectionId: string) =>
    fetchWithAuth(`${API_BASE_URL}/connections/${connectionId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  getSuggestions: (limit: number) =>
    fetchWithAuth(`${API_BASE_URL}/connections/suggestions?limit=${limit}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      const data = await handleResponse<any>(res);
      const suggestions: import('@/types/api').User[] = Array.isArray(data) ? data : (data?.suggestions ?? []);
      return { suggestions };
    }) as Promise<import('@/types/api').SuggestionsResponse>,
};

// --- Messages ---
async function getConversationWithUser(otherUserId: string): Promise<{ id: string } | null> {
  const list = await fetchWithAuth(`${API_BASE_URL}/messages/conversations`, {
    headers: getAuthHeaders(),
  }).then(handleResponse<Array<{ id: string; participants?: Array<{ id: string }> }>>);
  const arr = Array.isArray(list) ? list : [];
  const conv = arr.find(
    (c) => c.participants?.some((p: { id: string }) => p.id === otherUserId)
  );
  return conv ? { id: conv.id } : null;
}

const messages = {
  getConversations: async (_limit?: number, _offset?: number) => {
    const list = await fetchWithAuth(`${API_BASE_URL}/messages/conversations`, {
      headers: getAuthHeaders(),
    }).then(handleResponse<any[]>);
    return { conversations: Array.isArray(list) ? list : [] } as import('@/types/api').ConversationsResponse;
  },
  getMessages: async (otherUserId: string, limit: number, offset: number) => {
    const conv = await getConversationWithUser(otherUserId);
    if (!conv) return { messages: [] } as import('@/types/api').MessagesResponse;
    const list = await fetchWithAuth(
      `${API_BASE_URL}/messages/conversations/${conv.id}/messages?limit=${limit}&offset=${offset}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<any[]>);
    return { messages: Array.isArray(list) ? list : [] } as import('@/types/api').MessagesResponse;
  },
  sendMessage: (recipientId: string, content: string) =>
    fetchWithAuth(`${API_BASE_URL}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ receiver_id: recipientId, content }),
    }).then(handleResponse),
  markAsRead: (messageId: string) =>
    fetchWithAuth(`${API_BASE_URL}/messages/messages/${messageId}/read`, {
      method: "PUT",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  markConversationAsRead: async (otherUserId: string) => {
    const conv = await getConversationWithUser(otherUserId);
    if (!conv) return;
    return fetchWithAuth(`${API_BASE_URL}/messages/conversations/${conv.id}/read`, {
      method: "PUT",
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },
  getUnreadCount: () =>
    fetchWithAuth(`${API_BASE_URL}/messages/unread-count`, {
      headers: getAuthHeaders(),
    }).then(handleResponse<{ count: number }>),
};

// --- Notifications ---
const notifications = {
  getNotifications: async (limit: number, offset: number, unreadOnly?: boolean): Promise<import('@/types/api').NotificationsResponse> => {
    const list = await fetchWithAuth(
      `${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}&unread_only=${unreadOnly ?? false}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<import('@/types/api').Notification[]>);
    return { notifications: Array.isArray(list) ? list : [] };
  },
  getUnreadCount: () =>
    fetchWithAuth(`${API_BASE_URL}/notifications/unread-count`, {
      headers: getAuthHeaders(),
    }).then(handleResponse<{ count: number }>),
  markAsRead: (notificationId: string) =>
    fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  markAllAsRead: () =>
    fetchWithAuth(`${API_BASE_URL}/notifications/read-all`, {
      method: "PUT",
      headers: getAuthHeaders(),
    }).then(handleResponse),
  deleteNotification: (notificationId: string) =>
    fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};

// --- Search ---
const search = {
  searchAll: async (q: string, limit?: number): Promise<import('@/types/api').SearchResponse> => {
    const data = await fetchWithAuth(
      `${API_BASE_URL}/search/all?q=${encodeURIComponent(q)}&users_limit=${limit ?? 20}&posts_limit=${limit ?? 20}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<{ users?: { results: import('@/types/api').User[] }; posts?: { results: import('@/types/api').Post[] } }>);
    return {
      users: data.users?.results ?? [],
      posts: data.posts?.results ?? [],
    };
  },
  searchUsers: async (q: string, limit: number, _offset?: number): Promise<import('@/types/api').SearchResponse> => {
    const data = await fetchWithAuth(
      `${API_BASE_URL}/search/users?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<{ results: import('@/types/api').User[]; count?: number }>);
    return { users: Array.isArray(data.results) ? data.results : [] };
  },
  searchPosts: async (q: string, limit: number, _offset?: number): Promise<import('@/types/api').SearchResponse> => {
    const data = await fetchWithAuth(
      `${API_BASE_URL}/search/posts?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: getAuthHeaders() }
    ).then(handleResponse<{ results: import('@/types/api').Post[]; count?: number }>);
    return { posts: Array.isArray(data.results) ? data.results : [] };
  },
};

export const backendApi = {
  auth,
  profile,
  posts,
  connections,
  messages,
  notifications,
  search,
};
