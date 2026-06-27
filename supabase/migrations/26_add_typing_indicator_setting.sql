-- Typing indicator visibility (default TRUE = others can see when you're typing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_typing_indicator BOOLEAN DEFAULT TRUE;
