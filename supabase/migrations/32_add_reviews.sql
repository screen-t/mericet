-- Landing page reviews/testimonials, submitted by logged-in users and moderated
-- before appearing publicly. `status` is the moderation gate (spam/abuse check);
-- `is_featured` is a separate admin-curated flag controlling what actually shows
-- on the landing page. A review can be approved without being featured.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
        CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    status review_status DEFAULT 'pending',
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_status_created_at ON reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_featured ON reviews (is_featured) WHERE is_featured = TRUE;

-- Data access goes through the FastAPI backend (service_role key), consistent
-- with every other backend-owned table — see migration 30.
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
