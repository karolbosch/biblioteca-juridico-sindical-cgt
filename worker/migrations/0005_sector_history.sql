ALTER TABLE users ADD COLUMN sector TEXT;
CREATE TABLE IF NOT EXISTS query_history (id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,question TEXT NOT NULL,answer_excerpt TEXT,mode TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_query_history_user ON query_history(user_id,created_at DESC);
