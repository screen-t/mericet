// src/types/api.ts

// --- User ---
export interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  avatar_url?: string
  cover_url?: string
  headline?: string
  bio?: string
  location?: string
  website?: string
  pronouns?: string
  current_position?: string
  current_company?: string
  email_visible: boolean
  account_type: 'personal' | 'business'
  created_at: string
  updated_at: string
}

// --- Profile ---
export interface Profile extends User {
  id: string;

  // required identity fields
  email: string;
  username: string;

  // name
  first_name: string;
  last_name: string;

  // visibility + account info
  email_visible: boolean;
  account_type: "personal" | "business";

  // timestamps
  created_at: string;
  updated_at: string;

  // optional profile fields
  avatar_url?: string;
  cover_url?: string;
  headline?: string;
  bio?: string;
  location?: string;
  website?: string;
  pronouns?: string;
  current_position?: string;
  current_company?: string;

  // counts
  connections_count?: number;
  followers_count?: number;

  // relations
  work_experience?: WorkExperience[]
  education?: Education[]
  skills?: Skill[]
}

// --- Work Experience ---
export interface WorkExperience {
  id: string
  user_id: string
  title: string
  company: string
  location?: string
  start_date: string
  end_date?: string
  is_current: boolean
  description?: string
  created_at: string
  updated_at: string
}

export interface Comment {
  id: number;
  post_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  author?: User
}


// --- Education ---
export interface Education {
  id: string
  school: string
  degree: string
  field_of_study?: string | null
  start_date?: string | null
  end_date?: string | null
  user_id: string
  institution: string
  is_current: boolean
  grade?: string
  description?: string
  created_at: string
  updated_at: string
}

// --- Skill ---
export interface Skill {
  id: string
  user_id: string
  name: string
  created_at: string
}

// --- Post ---
export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls?: string[];
  visibility: "public" | "connections" | "private";
  is_repost: boolean;
  original_post_id?: string;
  repost_comment?: string;
  created_at: string;
  updated_at: string;
  author?: User;

  // Existing optional counts & flags
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  is_reposted?: boolean;   // needed for frontend

  // Poll support
  poll_options?: string[];
  poll_votes?: Array<{ option_index: number; votes_count: number }>;
  total_votes?: number;
  user_vote?: number;       // index of the user's vote
}

// --- Comment ---
// --- Connection ---
export interface Connection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  created_at: string;
  updated_at: string;
  requester?: User;
  receiver?: User;
  user?: User; // The other person in the connection
}

export interface ConnectionStatus {
  status: 'none' | 'pending' | 'accepted' | 'pending_from_them'
  connection_id?: string
}

// --- Message ---
export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  is_read: boolean
  created_at: string
  updated_at: string
  sender?: User
  recipient?: User
}

export interface Conversation {
  id: string;
  created_at: string;
  user?: User;
  participants?: Partial<User>[];
  last_message?: Message | null;
  unread_count: number;
}

// --- Notification ---
export interface Notification {
  id: string
  user_id: string
  type: 'like' | 'comment' | 'connection_request' | 'connection_accepted' | 'repost' | 'mention'
  content: string
  is_read: boolean
  actor_id?: string
  post_id?: string
  comment_id?: string
  connection_id?: string
  created_at: string
  actor?: User
}

// --- API Response Wrappers ---
export interface PostsResponse { posts: Post[] }
export interface CommentsResponse { comments: Comment[] }
export interface ConnectionsResponse { connections: User[] }
export interface SuggestionsResponse { suggestions: User[] }
export interface ConversationsResponse { conversations: Conversation[] }
export interface MessagesResponse { messages: Message[] }
export interface NotificationsResponse { notifications: Notification[]; count?: number }
export interface SearchResponse { users?: User[]; posts?: Post[] }
export interface UnreadCountResponse { count: number }

// --- Form Data Types for Mutations ---
export interface EducationFormData {
  institution: string
  degree: string
  field_of_study?: string
  start_date: string
  end_date?: string
  is_current: boolean
  grade?: string
  description?: string
}
export interface WorkExperienceFormData {
  title: string
  company: string
  location?: string
  start_date: string
  end_date?: string
  is_current: boolean
  description?: string
}

export interface CreatePostPayload {
  content: string;
  is_read: boolean;
  actor_id?: string;
  post_id?: string;
  comment_id?: string;
  connection_id?: string;
  created_at: string;
  actor?: User;
}

// API Response wrappers
export interface PostsResponse {
  posts: Post[];
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface ConnectionsResponse {
  connections: Connection[];
}

export interface SuggestionsResponse {
  suggestions: User[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesResponse {
  messages: Message[];
}

export interface NotificationsResponse {
  notifications: Notification[];
  count?: number;
}

export interface SearchResponse {
  users?: User[];
  posts?: Post[];
}

export interface UnreadCountResponse {
  count: number;
}
