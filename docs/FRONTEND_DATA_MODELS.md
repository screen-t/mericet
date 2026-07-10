# Frontend Data Models & State Management

This document describes the data structures and state management patterns used in the Mericet frontend application.

## State Management

The application uses **TanStack Query (React Query)** for server state management and React's built-in `useState` for local UI state.

## Core Data Models

### User

```typescript
interface User {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  additionalName?: string;
  pronouns?: string;
  username: string;
  headline?: string;
  bio?: string;
  birthdate?: string;
  location?: string;
  postalCode?: string;
  address?: string;
  website?: string;
  currentPosition?: string;
  currentCompany?: string;
  industry?: string;
  accountType: 'professional' | 'business';
  avatarUrl?: string;
  coverUrl?: string;
  isVerified: boolean;
  privacySettings: PrivacySettings;
  createdAt: string;
  updatedAt: string;
}
```

### PrivacySettings

```typescript
interface PrivacySettings {
  emailVisible: boolean;
  phoneVisible: boolean;
  birthdayVisible: boolean;
  locationVisible: boolean;
  workHistoryVisible: boolean;
  connectionsVisible: boolean;
  activityStatusVisible: boolean;
}
```

### WorkExperience

```typescript
interface WorkExperience {
  id: string;
  userId: string;
  company: string;
  position: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
  displayOrder: number;
}
```

### Education

```typescript
interface Education {
  id: string;
  userId: string;
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  displayOrder: number;
}
```

### Post

```typescript
interface Post {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
    headline?: string;
    isVerified: boolean;
  };
  content: string;
  postType: 'text' | 'image' | 'video' | 'poll';
  visibility: 'public' | 'connections' | 'private';
  media?: PostMedia[];
  poll?: PostPoll;
  tags: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  shareCount: number;
  isLiked: boolean;
  isReposted: boolean;
  isSaved: boolean;
  createdAt: string;
  updatedAt?: string;
  scheduledAt?: string;
  isDraft: boolean;
}
```

### PostMedia

```typescript
interface PostMedia {
  id: string;
  postId: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
}
```

### PostPoll

```typescript
interface PostPoll {
  id: string;
  postId: string;
  question: string;
  options: PollOption[];
  endsAt?: string;
  hasVoted: boolean;
  userVote?: string; // option id
}

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}
```

### Comment

```typescript
interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
  };
  content: string;
  likeCount: number;
  isLiked: boolean;
  parentCommentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt?: string;
}
```

### Connection

```typescript
interface Connection {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
    headline?: string;
  };
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: string;
  updatedAt: string;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

interface ConversationParticipant {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl?: string;
}
```

### Message

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  content: string;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}
```

### Notification

```typescript
interface Notification {
  id: string;
  userId: string;
  type: 'connection_request' | 'connection_accepted' | 'post_like' | 'post_comment' | 'mention' | 'message';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}
```

### LoginActivity

```typescript
interface LoginActivity {
  id: string;
  userId: string;
  device: string;
  browser: string;
  location: string;
  ipAddress: string;
  status: 'success' | 'failed';
  createdAt: string;
  sessionId?: string;
  isActive: boolean;
}
```

### ConnectedAccount

```typescript
interface ConnectedAccount {
  id: string;
  provider: 'google' | 'github' | 'linkedin' | 'email' | 'phone';
  email?: string;
  phone?: string;
  connectedAt: string;
}
```

## TanStack Query Keys

Query keys for caching and invalidation:

```typescript
const queryKeys = {
  // User
  currentUser: ['user', 'me'],
  user: (username: string) => ['user', username],
  userWorkExperience: (userId: string) => ['user', userId, 'work-experience'],
  userEducation: (userId: string) => ['user', userId, 'education'],
  userSkills: (userId: string) => ['user', userId, 'skills'],
  
  // Posts
  posts: (feed: 'for-you' | 'following') => ['posts', feed],
  userPosts: (userId: string) => ['posts', 'user', userId],
  post: (postId: string) => ['post', postId],
  postComments: (postId: string) => ['post', postId, 'comments'],
  
  // Connections
  connections: (status?: string) => ['connections', { status }],
  connectionRequests: ['connections', 'requests'],
  
  // Messages
  conversations: ['conversations'],
  conversation: (conversationId: string) => ['conversation', conversationId],
  messages: (conversationId: string) => ['messages', conversationId],
  
  // Notifications
  notifications: ['notifications'],
  unreadCount: ['notifications', 'unread-count'],
  
  // Security
  loginActivity: ['security', 'login-activity'],
  connectedAccounts: ['security', 'connected-accounts'],
};
```

## Local State Patterns

### Form State (Onboarding)

```typescript
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  headline: '',
  currentPosition: '',
  currentCompany: '',
});
```

### UI State

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [currentStep, setCurrentStep] = useState(1);
const [activeTab, setActiveTab] = useState('for-you');
```

### Create Post State

```typescript
const [content, setContent] = useState('');
const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('public');
const [mediaType, setMediaType] = useState<'image' | 'video' | 'poll' | null>(null);
const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
```

## API Integration Examples

### Fetching Posts

```typescript
const { data, isLoading } = useQuery({
  queryKey: queryKeys.posts(activeTab),
  queryFn: async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, user:users(*)')
      .order('created_at', { ascending: false })
      .limit(20);
    return data;
  },
});
```

### Creating a Post

```typescript
const mutation = useMutation({
  mutationFn: async (postData: CreatePostInput) => {
    const { data } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.posts('for-you') });
  },
});
```

### Updating User Profile

```typescript
const updateProfile = useMutation({
  mutationFn: async (updates: Partial<User>) => {
    const { data } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
  },
});
```

## Real-time Subscriptions

### Messages

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => {
      queryClient.setQueryData(
        queryKeys.messages(conversationId),
        (old: Message[]) => [...old, payload.new as Message]
      );
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [conversationId]);
```

### Notifications

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

## Component Props Patterns

### PostCard Props

```typescript
interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onSave?: (postId: string) => void;
}
```

### EditProfileModal Props

```typescript
interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSave: (updates: Partial<User>) => Promise<void>;
}
```

## Validation Schemas (Zod)

```typescript
import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().min(1).max(2000),
  visibility: z.enum(['public', 'connections', 'private']),
  scheduledAt: z.date().optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  headline: z.string().max(120).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
});
```

## Performance Optimization

- Use `React.memo()` for expensive components (PostCard, etc.)
- Implement virtual scrolling for long feeds
- Lazy load images with `loading="lazy"`
- Prefetch next page of posts on scroll
- Debounce search inputs
- Optimize re-renders with `useMemo` and `useCallback`
