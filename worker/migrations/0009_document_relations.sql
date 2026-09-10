CREATE TABLE IF NOT EXISTS document_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  strength TEXT NOT NULL DEFAULT 'DESCUBRIMIENTO',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_relations_source ON document_relations(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON document_relations(target_doc_id);
