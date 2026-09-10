ALTER TABLE documents ADD COLUMN doc_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_doc_id ON documents(doc_id);
