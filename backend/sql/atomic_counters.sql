-- Atomic like counter RPCs (matches existing increment_post_reposts/decrement_post_reposts pattern)
-- Run this in Supabase SQL Editor to enable atomic like counts.

CREATE OR REPLACE FUNCTION increment_post_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET like_count = like_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_likes(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;
