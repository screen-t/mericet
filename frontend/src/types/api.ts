// API Response Types

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  cover_url?: string;
  headline?: string;
  bio?: string;
  location?: string;
  website?: string;
  pronouns?: string;
  current_position?: string;
  current_company?: string;
  email_visible: boolean;
  account_type: 'personal' | 'business';
  created_at: string;
  updated_at: string;
  connections_count?: number;
  followers_count?: number;
}

export interface Profile extends User {
  work_experience?: WorkExperience[];
  education?: Education[];
  skills?: Skill[];
}

export interface WorkExperience {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Education {
  id: string;
  user_id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  grade?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  user_id: string;
  skill: string;
  created_at: string;
}

export interface Post {
  id: string;
  // Backend uses author_id; user_id kept for legacy compatibility
  user_id?: string;
  author_id?: string;
  content: string;
  // Backend returns media as objects; media_urls kept for legacy
  media_urls?: string[];
  media?: Array<{ url: string; media_type?: string; thumbnail_url?: string | null }>;
  poll_options?: string[];
  poll_duration_hours?: number;
  visibility: 'public' | 'connections' | 'private';
  is_repost?: boolean;
  original_post_id?: string;
  repost_comment?: string;
  created_at: string;
  updated_at?: string;
  edited_at?: string | null;
  author?: User;
  // Backend field names (snake_case without trailing 's')
  like_count?: number;
  comment_count?: number;
  repost_count?: number;
  share_count?: number;
  // Legacy aliases — keep for any code that still uses these
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  is_liked?: boolean;
  is_reposted?: boolean;
  is_saved?: boolean;
  poll?: { id: string; question: string; ends_at?: string | null; options?: Array<{ id: string; option_text: string; vote_count: number; display_order: number }>; user_vote?: string | null };
  poll_votes?: PollVote[];
  original_post?: Post;
  total_votes?: number;
  user_vote?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface PollVote {
  option_index: number;
  votes_count: number;
  has_voted?: boolean;
}

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
  status: 'none' | 'pending' | 'accepted' | 'pending_from_them';
  connection_id?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  edited_at?: string | null;
  edit_count?: number;
  updated_at?: string;
  sender?: User;
  recipient?: User;
}

export interface Conversation {
  id: string;
  created_at: string;
  user?: User;
  participants?: Partial<User>[];
  last_message?: Message | null;
  unread_count: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'connection_request' | 'connection_accepted' | 'repost' | 'mention';
  content: string;
  message?: string;
  is_read: boolean;
  actor_id?: string;
  post_id?: string;
  comment_id?: string;
  connection_id?: string;
  created_at: string;
  actor?: User;
  post_preview?: string;
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
