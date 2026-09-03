ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN created_by TEXT;
ALTER TABLE users ADD COLUMN updated_at TEXT;
ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'editor';
ALTER TABLE sessions ADD COLUMN user_id INTEGER;
ALTER TABLE uploads ADD COLUMN title TEXT;
ALTER TABLE uploads ADD COLUMN matter TEXT;
ALTER TABLE uploads ADD COLUMN court_level TEXT;
ALTER TABLE uploads ADD COLUMN resolution_number TEXT;
ALTER TABLE uploads ADD COLUMN resolution_date TEXT;
ALTER TABLE uploads ADD COLUMN procedural_status TEXT;
ALTER TABLE uploads ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active,role);
CREATE TABLE IF NOT EXISTS review_candidates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'sentencia',
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  court_level TEXT,
  resolution_number TEXT,
  resolution_date TEXT,
  matter TEXT,
  summary TEXT,
  procedural_status TEXT NOT NULL DEFAULT 'SITUACION_PROCESAL_NO_VERIFICADA',
  original_key TEXT NOT NULL,
  anonymized_key TEXT NOT NULL,
  sha256_original TEXT,
  sha256_anonymized TEXT,
  privacy_status TEXT NOT NULL DEFAULT 'REQUIERE_REVISION',
  automated_checks_json TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notification_sent_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  published_document_id INTEGER REFERENCES documents(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_candidates_source ON review_candidates(source_url);
CREATE INDEX IF NOT EXISTS idx_review_candidates_status ON review_candidates(privacy_status,discovered_at DESC);
PRAGMA optimize;
