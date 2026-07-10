-- Store notification preferences as JSON on users table
-- Default: all enabled
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "connection_requests": true,
  "mentions": true,
  "new_followers": true,
  "post_engagement": true,
  "show_preview": true
}'::jsonb;
