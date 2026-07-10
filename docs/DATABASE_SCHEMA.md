# Database Schema Requirements

This document outlines the database schema required to support the Mericet frontend application.

## Overview

The application uses PostgreSQL via Supabase. All tables should implement Row Level Security (RLS) policies for data protection.

## Core Tables

### users

Stores user profile information and authentication details.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Basic Info
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  additional_name TEXT,
  pronouns TEXT,
  username TEXT UNIQUE NOT NULL,
  
  -- Profile
  headline TEXT,
  bio TEXT,
  birthdate DATE,
  location TEXT,
  postal_code TEXT,
  address TEXT,
  website TEXT,
  
  -- Professional
  current_position TEXT,
  current_company TEXT,
  industry TEXT,
  
  -- Account Settings
  account_type TEXT DEFAULT 'professional' CHECK (account_type IN ('professional', 'business')),
  avatar_url TEXT,
  cover_url TEXT,
  
  -- Privacy Settings
  email_visible BOOLEAN DEFAULT false,
  phone_visible BOOLEAN DEFAULT false,
  birthday_visible BOOLEAN DEFAULT false,
  location_visible BOOLEAN DEFAULT false,
  work_history_visible BOOLEAN DEFAULT true,
  connections_visible BOOLEAN DEFAULT true,
  activity_status_visible BOOLEAN DEFAULT true,
  
  -- Metadata
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### work_experience

User work history entries.

```sql
CREATE TABLE work_experience (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  
  display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_work_experience_user ON work_experience(user_id);
```

### education

User education history.

```sql
CREATE TABLE education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  
  display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_education_user ON education(user_id);
```

### user_skills

User skills and endorsements.

```sql
CREATE TABLE user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  endorsement_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, skill)
);

CREATE INDEX idx_user_skills_user ON user_skills(user_id);
```

### posts

User posts and content.

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  
  content TEXT NOT NULL,
  post_type TEXT DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video', 'poll')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'connections', 'private')),
  
  -- Engagement
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Status
  is_published BOOLEAN DEFAULT true,
  is_draft BOOLEAN DEFAULT false,
  
  -- Metadata
  edited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
```

### post_media

Media attachments for posts (images, videos).

```sql
CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_post_media_post ON post_media(post_id);
```

### post_polls

Poll data for posts.

```sql
CREATE TABLE post_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE post_poll_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES post_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE post_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES post_polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES post_poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(poll_id, user_id)
);
```

### post_tags

Hashtags for posts.

```sql
CREATE TABLE post_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_post_tags_post ON post_tags(post_id);
CREATE INDEX idx_post_tags_tag ON post_tags(tag);
```

### comments

Comments on posts.

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_user ON comments(user_id);
```

### post_likes

Post like tracking.

```sql
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);
```

### reposts

Repost tracking.

```sql
CREATE TABLE reposts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_reposts_post ON reposts(post_id);
CREATE INDEX idx_reposts_user ON reposts(user_id);
```

### saved_posts

Bookmarked posts.

```sql
CREATE TABLE saved_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_saved_posts_user ON saved_posts(user_id);
```

### connections

User connections/relationships.

```sql
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(requester_id, receiver_id)
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);
```

### messages

Direct messages between users.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

### notifications

User notifications.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
```

### login_activity

Security tracking for user login sessions.

```sql
CREATE TABLE login_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device TEXT,
  browser TEXT,
  location TEXT,
  ip_address TEXT,
  status TEXT CHECK (status IN ('success', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_login_activity_user ON login_activity(user_id);
CREATE INDEX idx_login_activity_created ON login_activity(created_at DESC);
```

### connected_accounts

OAuth and social login connections.

```sql
CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github', 'linkedin', 'email', 'phone')),
  provider_user_id TEXT,
  email TEXT,
  phone TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_connected_accounts_user ON connected_accounts(user_id);
```

## Database Functions

### Update updated_at timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Row Level Security (RLS) Policies

Enable RLS on all tables and create policies based on user authentication and relationships.

Example for posts table:

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can view public posts, their connections' posts, and their own posts
CREATE POLICY "Posts are viewable based on visibility" ON posts
  FOR SELECT USING (
    visibility = 'public' OR
    user_id = auth.uid() OR
    (visibility = 'connections' AND user_id IN (
      SELECT receiver_id FROM connections WHERE requester_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT requester_id FROM connections WHERE receiver_id = auth.uid() AND status = 'accepted'
    ))
  );

-- Users can only insert their own posts
CREATE POLICY "Users can insert own posts" ON posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only update their own posts
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (user_id = auth.uid());

-- Users can only delete their own posts
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (user_id = auth.uid());
```

## Migration Notes

1. Create tables in order to respect foreign key constraints
2. Enable RLS on all tables before deploying to production
3. Create indexes for performance on frequently queried columns
4. Set up database triggers for automatic timestamp updates
5. Implement proper backup and recovery procedures
6. Consider partitioning large tables (posts, messages) for better performance

## Additional Considerations

- Implement soft deletes for posts and comments if needed
- Add full-text search indexes for posts and user profiles
- Consider materialized views for feed generation
- Set up database replication for high availability
- Implement rate limiting at the database level for sensitive operations
