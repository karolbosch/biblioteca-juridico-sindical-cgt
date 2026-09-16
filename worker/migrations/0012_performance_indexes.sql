CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_sector_privacy ON documents(sector, privacy_status);
CREATE INDEX IF NOT EXISTS idx_documents_privacy ON documents(privacy_status);
CREATE INDEX IF NOT EXISTS idx_documents_doc_id_lookup ON documents(doc_id, privacy_status);
