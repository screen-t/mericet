# Backend Integration Guide

This guide helps backend developers integrate their API with the Mericet frontend application.

## Architecture Note

The backend uses a **Repository Pattern** with dependency injection. All data access goes through repository classes in `backend/app/repositories/`, wired via `backend/app/deps.py`. Routes never call Supabase directly — they inject repositories via FastAPI's `Depends()`. See [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) for details.

## Quick Start

1. Review the [API Requirements](./API_REQUIREMENTS.md) for all endpoint specifications
2. Review the [Database Schema](./DATABASE_SCHEMA.md) for data structure
3. Review the [Architecture Plan](./ARCHITECTURE_PLAN.md) for repository pattern
4. Set up Supabase authentication
5. Test with the frontend

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the `frontend` directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Authentication Flow

### 1. Email/Password Login

Frontend sends:
```typescript
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

Backend should:
1. Validate credentials
2. Create session via Supabase Auth
3. Return user data and tokens
4. Log login activity to `login_activity` table

### 2. OAuth Login

Frontend redirects to:
```
/auth/oauth/google
/auth/oauth/github
/auth/oauth/linkedin
```

Backend should:
1. Handle OAuth callback
2. Create or update user record
3. Store OAuth connection in `connected_accounts` table
4. Return session tokens

## Critical Endpoints Implementation

### Feed Generation (Priority 1)

**GET /posts?feed=for-you&limit=20**

Algorithm for "For You" feed:
1. Get user's connections
2. Get posts from connections (weight: 0.7)
3. Get popular posts from network (weight: 0.2)
4. Get posts matching user interests (weight: 0.1)
5. Sort by recency and engagement
6. Apply visibility filters

For "Following" feed:
1. Get posts from user's connections only
2. Sort by recency
3. Apply visibility filters

Return format:
```json
{
  "posts": [...],
  "hasMore": true,
  "nextOffset": 20
}
```

### Post Creation (Priority 1)

**POST /posts**

Backend must:
1. Validate content length (max 2000 chars)
2. Extract and store hashtags in `post_tags` table
3. If media attached, validate and store in `post_media` table
4. If poll attached, create records in `post_polls` and `post_poll_options`
5. If scheduled, set `scheduled_at` and `is_published=false`
6. Parse @mentions and create notifications
7. Return complete post object with user data

### Real-time Messages (Priority 2)

Messages use Supabase Realtime. Backend must:

1. Enable realtime on `messages` table
2. Implement RLS policies for message access
3. Update `conversations.updated_at` on new message
4. Create notification for recipient
5. Mark sender's messages as read

Frontend subscribes to:
```typescript
supabase
  .channel('conversation:${id}')
  .on('postgres_changes', { ... })
```

### Notifications (Priority 2)

Create notifications for:
- Connection requests
- Connection accepted
- Post likes (aggregate if > 5 in short time)
- Post comments
- Mentions in posts
- New messages

Notification types:
```typescript
type NotificationType = 
  | 'connection_request'
  | 'connection_accepted'
  | 'post_like'
  | 'post_comment'
  | 'mention'
  | 'message';
```

## Data Relationships

### User Profile with Related Data

When fetching user profile, include:
```sql
SELECT 
  users.*,
  (SELECT COUNT(*) FROM connections WHERE receiver_id = users.id AND status = 'accepted') as connection_count,
  (SELECT json_agg(work_experience.*) FROM work_experience WHERE user_id = users.id ORDER BY is_current DESC, start_date DESC) as work_experience,
  (SELECT json_agg(education.*) FROM education WHERE user_id = users.id ORDER BY start_date DESC) as education,
  (SELECT json_agg(skill) FROM user_skills WHERE user_id = users.id) as skills
FROM users
WHERE username = $1;
```

### Post with Engagement Status

Include current user's engagement:
```sql
SELECT 
  posts.*,
  users.first_name, users.last_name, users.username, users.avatar_url,
  EXISTS(SELECT 1 FROM post_likes WHERE post_id = posts.id AND user_id = $current_user_id) as is_liked,
  EXISTS(SELECT 1 FROM reposts WHERE post_id = posts.id AND user_id = $current_user_id) as is_reposted,
  EXISTS(SELECT 1 FROM saved_posts WHERE post_id = posts.id AND user_id = $current_user_id) as is_saved
FROM posts
JOIN users ON posts.user_id = users.id;
```

## Security Considerations

### Row Level Security (RLS)

Enable RLS on all tables. Example for posts:

```sql
-- Users can see public posts
CREATE POLICY "Public posts are visible" ON posts
  FOR SELECT USING (visibility = 'public');

-- Users can see their connections' posts
CREATE POLICY "Connection posts are visible" ON posts
  FOR SELECT USING (
    visibility = 'connections' AND
    user_id IN (
      SELECT receiver_id FROM connections 
      WHERE requester_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT requester_id FROM connections 
      WHERE receiver_id = auth.uid() AND status = 'accepted'
    )
  );

-- Users can see their own posts
CREATE POLICY "Own posts are visible" ON posts
  FOR SELECT USING (user_id = auth.uid());
```

### API Security

1. Validate JWT tokens on all protected routes
2. Implement rate limiting (see API_REQUIREMENTS.md)
3. Sanitize user inputs to prevent XSS
4. Use parameterized queries to prevent SQL injection
5. Validate file uploads (type, size, content)
6. Implement CORS properly

## File Upload Handling

### Image/Video Upload

Frontend expects:
```typescript
POST /media/upload
Content-Type: multipart/form-data

FormData:
- file: File
```

The backend validates file type and size, uploads via StorageService (abstracted from Supabase Storage), and returns:

```json
{
  "url": "https://...",
  "path": "post-media/..."
}
```

Storage structure:
```
/posts/images/{user_id}/{timestamp}_{filename}
/posts/videos/{user_id}/{timestamp}_{filename}
/posts/videos/thumbnails/{user_id}/{timestamp}_{filename}
/avatars/{user_id}/{filename}
/covers/{user_id}/{filename}
```

## Testing with Frontend

### 1. Set Up Test Data

Create test users with different roles:
- Professional user
- Business user
- User with connections
- User without connections

### 2. Test Authentication

```bash
# Test email login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test token refresh
curl -X POST http://localhost:8000/auth/refresh \
  -H "Authorization: Bearer {refresh_token}"
```

### 3. Test Feed Generation

```bash
# Test For You feed
curl -X GET "http://localhost:8000/posts?feed=for-you&limit=20" \
  -H "Authorization: Bearer {access_token}"

# Test Following feed
curl -X GET "http://localhost:8000/posts?feed=following&limit=20" \
  -H "Authorization: Bearer {access_token}"
```

### 4. Test Post Creation

```bash
# Create text post
curl -X POST http://localhost:8000/posts \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My first post #hello @johndoe",
    "visibility": "public"
  }'

# Upload media
curl -X POST http://localhost:8000/media/upload \
  -H "Authorization: Bearer {access_token}" \
  -F "file=@image.jpg"
```

## Common Issues & Solutions

### CORS Errors

CORS is configured in `backend/app/main.py`. Allowed origins include localhost dev ports and production domains. Add new origins via the `FRONTEND_URL` or `ALLOWED_ORIGINS` environment variables.

### JWT Token Expiration

Frontend handles token refresh automatically. Ensure:
1. Access tokens expire in 1 hour
2. Refresh tokens expire in 7 days
3. Return proper 401 status on expired tokens

### Real-time Not Working

Check:
1. Supabase Realtime is enabled for tables
2. RLS policies allow realtime subscriptions
3. Frontend has correct channel names
4. User has permission to access data

### Slow Feed Loading

Optimize with:
1. Database indexes on `posts.created_at`, `posts.user_id`
2. Limit query complexity
3. Use connection pooling
4. Cache frequently accessed data
5. Consider pagination cursor instead of offset

## Performance Benchmarks

Target response times:
- Authentication: < 500ms
- Feed loading: < 1s
- Post creation: < 500ms
- Profile loading: < 800ms
- Message sending: < 300ms
- Notifications: < 200ms

## Deployment Checklist

Before deploying backend:

- [ ] All RLS policies enabled on production
- [ ] Environment variables configured
- [ ] Database migrations run successfully
- [ ] File upload storage configured
- [ ] Rate limiting implemented
- [ ] Error logging configured
- [ ] Health check endpoint working
- [ ] CORS configured for production domain
- [ ] SSL/TLS certificates configured
- [ ] Backup and recovery tested
- [ ] Load testing completed
- [ ] Security audit passed

## Support

For integration questions:
1. Check API documentation
2. Review data models
3. Test with provided curl commands
4. Check Supabase logs
5. Open issue in repository
