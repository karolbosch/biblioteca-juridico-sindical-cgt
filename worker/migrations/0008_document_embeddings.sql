CREATE TABLE IF NOT EXISTS document_embeddings (
  document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  embedding TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
