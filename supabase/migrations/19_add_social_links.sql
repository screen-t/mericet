-- Add social media link columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url TEXT;
