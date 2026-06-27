# Backend API Requirements

This document outlines the API endpoints required by the Mericet frontend application.

## Base URL

```
/api/v1
```

## Authentication

All endpoints (except auth and public routes) require JWT authentication via Supabase.

Headers:
```
Authorization: Bearer <token>
```

## Auth Endpoints

### POST /auth/signup
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

### POST /auth/login
Login with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

### POST /auth/login/phone
Login with phone number.

**Request:**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

### POST /auth/oauth/{provider}
OAuth login (Google, GitHub, LinkedIn).

**Providers:** `google`, `github`, `linkedin`

### POST /auth/logout
Logout current session.

### POST /auth/refresh
Refresh access token.

## User Endpoints

### GET /users/me
Get current user profile.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "headline": "Product Manager at Acme",
  "bio": "Building great products...",
  "avatarUrl": "https://...",
  "coverUrl": "https://...",
  "accountType": "professional",
  "location": "San Francisco, CA",
  "website": "https://johndoe.com",
  "privacySettings": {
    "emailVisible": false,
    "phoneVisible": false
  }
}
```

### PATCH /users/me
Update current user profile.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "headline": "Senior Product Manager",
  "bio": "Updated bio...",
  "location": "New York, NY",
  "pronouns": "he/him"
}
```

### GET /users/{username}
Get user profile by username.

### GET /users/{id}/work-experience
Get user work history.

**Response:**
```json
[
  {
    "id": "uuid",
    "company": "Acme Inc",
    "position": "Product Manager",
    "location": "San Francisco",
    "startDate": "2020-01-01",
    "endDate": null,
    "isCurrent": true,
    "description": "Leading product development..."
  }
]
```

### POST /users/me/work-experience
Add work experience entry.

### PATCH /users/me/work-experience/{id}
Update work experience entry.

### DELETE /users/me/work-experience/{id}
Delete work experience entry.

### GET /users/me/education
Get user education history.

### POST /users/me/education
Add education entry.

### GET /users/me/skills
Get user skills.

### POST /users/me/skills
Add skill.

**Request:**
```json
{
  "skill": "JavaScript"
}
```

### DELETE /users/me/skills/{skill}
Remove skill.

## Post Endpoints

### GET /posts
Get posts feed.

**Query Parameters:**
- `feed` - "for-you" or "following" (default: "for-you")
- `limit` - Number of posts (default: 20)
- `offset` - Pagination offset
- `userId` - Filter by user ID

**Response:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "userId": "uuid",
      "user": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "username": "johndoe",
        "avatarUrl": "https://..."
      },
      "content": "Just launched our new feature!",
      "postType": "text",
      "visibility": "public",
      "likeCount": 42,
      "commentCount": 5,
      "repostCount": 3,
      "shareCount": 1,
      "createdAt": "2026-01-11T10:00:00Z",
      "tags": ["#product", "#launch"],
      "media": [],
      "isLiked": false,
      "isReposted": false,
      "isSaved": false
    }
  ],
  "hasMore": true
}
```

### POST /posts
Create a new post.

**Request:**
```json
{
  "content": "My new post content with #hashtags",
  "visibility": "public",
  "postType": "text",
  "scheduledAt": null,
  "isDraft": false
}
```

### POST /posts/upload-media
Upload media for post (image or video).

**Request:** multipart/form-data
- `file` - Media file
- `type` - "image" or "video"

**Response:**
```json
{
  "url": "https://storage.../file.jpg",
  "thumbnailUrl": "https://storage.../thumb.jpg"
}
```

### POST /posts/{id}/poll
Create poll for post.

**Request:**
```json
{
  "question": "What's your favorite feature?",
  "options": ["Feature A", "Feature B", "Feature C"]
}
```

### PATCH /posts/{id}
Update post.

### DELETE /posts/{id}
Delete post.

### POST /posts/{id}/like
Like a post.

### DELETE /posts/{id}/like
Unlike a post.

### POST /posts/{id}/repost
Repost a post.

### DELETE /posts/{id}/repost
Remove repost.

### POST /posts/{id}/save
Save/bookmark a post.

### DELETE /posts/{id}/save
Remove bookmark.

### GET /posts/{id}/comments
Get post comments.

### POST /posts/{id}/comments
Add comment to post.

**Request:**
```json
{
  "content": "Great post!",
  "parentCommentId": null
}
```

## Connection Endpoints

### GET /connections
Get user connections.

**Query Parameters:**
- `status` - "pending", "accepted", "declined"
- `type` - "sent", "received"

**Response:**
```json
{
  "connections": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "username": "janesmith",
        "avatarUrl": "https://...",
        "headline": "CEO at StartupCo"
      },
      "status": "accepted",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### POST /connections
Send connection request.

**Request:**
```json
{
  "userId": "uuid"
}
```

### PATCH /connections/{id}
Update connection status.

**Request:**
```json
{
  "status": "accepted"
}
```

### DELETE /connections/{id}
Remove connection.

## Message Endpoints

### GET /conversations
Get user conversations.

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "participants": [
        {
          "id": "uuid",
          "firstName": "Jane",
          "lastName": "Smith",
          "avatarUrl": "https://..."
        }
      ],
      "lastMessage": {
        "content": "Hey, how are you?",
        "createdAt": "2026-01-11T10:00:00Z",
        "isRead": true
      },
      "unreadCount": 0,
      "updatedAt": "2026-01-11T10:00:00Z"
    }
  ]
}
```

### POST /conversations
Create new conversation.

**Request:**
```json
{
  "participantIds": ["uuid1", "uuid2"]
}
```

### GET /conversations/{id}/messages
Get conversation messages.

**Query Parameters:**
- `limit` - Number of messages (default: 50)
- `before` - Message ID for pagination

### POST /conversations/{id}/messages
Send message.

**Request:**
```json
{
  "content": "Hello there!"
}
```

### PATCH /conversations/{id}/messages/read
Mark messages as read.

## Notification Endpoints

### GET /notifications
Get user notifications.

**Query Parameters:**
- `unreadOnly` - Boolean (default: false)
- `limit` - Number of notifications (default: 20)

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "connection_request",
      "title": "New connection request",
      "message": "Jane Smith wants to connect",
      "link": "/profile/janesmith",
      "isRead": false,
      "createdAt": "2026-01-11T10:00:00Z"
    }
  ],
  "unreadCount": 5
}
```

### PATCH /notifications/{id}/read
Mark notification as read.

### PATCH /notifications/read-all
Mark all notifications as read.

## Security Endpoints

### GET /security/login-activity
Get user login history.

**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "device": "Chrome on Windows",
      "browser": "Chrome 120",
      "location": "San Francisco, CA",
      "ipAddress": "192.168.1.1",
      "status": "success",
      "createdAt": "2026-01-11T10:00:00Z",
      "isActive": true
    }
  ]
}
```

### POST /security/revoke-session
Revoke a login session.

**Request:**
```json
{
  "sessionId": "uuid"
}
```

### GET /security/connected-accounts
Get connected OAuth accounts.

### POST /security/connected-accounts/{provider}
Connect OAuth account.

### DELETE /security/connected-accounts/{provider}
Disconnect OAuth account.

### PATCH /security/password
Change password.

**Request:**
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass"
}
```

### POST /security/2fa/enable
Enable two-factor authentication.

### POST /security/2fa/disable
Disable two-factor authentication.

## Search Endpoints

### GET /search
Global search.

**Query Parameters:**
- `q` - Search query
- `type` - "users", "posts", "companies" (default: all)
- `limit` - Number of results (default: 10)

**Response:**
```json
{
  "users": [...],
  "posts": [...],
  "companies": [...]
}
```

## Real-time (WebSocket/Supabase Realtime)

### Subscriptions

- `messages:conversation_id` - Real-time messages for a conversation
- `notifications:user_id` - Real-time notifications for user
- `posts:feed` - Real-time feed updates

## Rate Limiting

- Auth endpoints: 5 requests/minute
- Post creation: 10 posts/hour
- Message sending: 60 messages/hour
- General API: 100 requests/minute per user

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

Common HTTP status codes:
- 200 - Success
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 429 - Too Many Requests
- 500 - Internal Server Error
