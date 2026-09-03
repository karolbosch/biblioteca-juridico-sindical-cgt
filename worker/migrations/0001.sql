PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sectors (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES sectors(id)
);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  sector_id INTEGER REFERENCES sectors(id)
);
CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  province TEXT,
  UNIQUE(name,province)
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT,
  is_official INTEGER NOT NULL DEFAULT 0 CHECK(is_official IN (0,1))
);
CREATE TABLE IF NOT EXISTS procedural_chains (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  procedural_status TEXT NOT NULL DEFAULT 'SITUACION_PROCESAL_NO_VERIFICADA',
  final_authority TEXT,
  current_rule_summary TEXT,
  appeal_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  matter TEXT,
  submatter TEXT,
  company TEXT,
  company_id INTEGER REFERENCES companies(id),
  sector TEXT,
  sector_id INTEGER REFERENCES sectors(id),
  court TEXT,
  court_id INTEGER REFERENCES courts(id),
  court_level TEXT,
  resolution_number TEXT,
  resolution_type TEXT,
  date TEXT,
  year INTEGER,
  outcome TEXT,
  summary TEXT,
  criteria TEXT,
  key_points TEXT,
  topics TEXT,
  topics_text TEXT,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'OTRA_FUENTE',
  source_id INTEGER REFERENCES sources(id),
  downloaded_at TEXT,
  sha256 TEXT,
  ecli TEXT,
  roj TEXT,
  case_number TEXT,
  appeal_number TEXT,
  pdf_original_path TEXT,
  pdf_public_path TEXT,
  full_text_path TEXT,
  full_text TEXT,
  is_full_text INTEGER NOT NULL DEFAULT 0 CHECK(is_full_text IN (0,1)),
  document_status TEXT NOT NULL DEFAULT 'FICHA',
  privacy_status TEXT NOT NULL DEFAULT 'ANONIMIZACION_PENDIENTE',
  procedural_status TEXT NOT NULL DEFAULT 'SITUACION_PROCESAL_NO_VERIFICADA',
  chain_id TEXT REFERENCES procedural_chains(id),
  preceding_case_ids TEXT,
  subsequent_case_ids TEXT,
  final_authority TEXT,
  current_rule_summary TEXT,
  itss_status TEXT,
  appeal_verified_at TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256) WHERE sha256 IS NOT NULL AND sha256!='';
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_ecli ON documents(ecli) WHERE ecli IS NOT NULL AND ecli!='';
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_roj ON documents(roj) WHERE roj IS NOT NULL AND roj!='';
CREATE INDEX IF NOT EXISTS idx_documents_matter_status ON documents(matter,procedural_status);
CREATE INDEX IF NOT EXISTS idx_documents_sector_date ON documents(sector,date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_court_date ON documents(court_level,date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_type_privacy ON documents(document_type,privacy_status);
CREATE INDEX IF NOT EXISTS idx_documents_chain ON documents(chain_id);
CREATE INDEX IF NOT EXISTS idx_documents_public ON documents(date DESC) WHERE privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA');

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title, matter, submatter, company, summary, criteria, key_points, topics_text, full_text,
  content='documents', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid,title,matter,submatter,company,summary,criteria,key_points,topics_text,full_text)
  VALUES(new.id,new.title,new.matter,new.submatter,new.company,new.summary,new.criteria,new.key_points,new.topics_text,new.full_text);
END;
CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts,rowid,title,matter,submatter,company,summary,criteria,key_points,topics_text,full_text)
  VALUES('delete',old.id,old.title,old.matter,old.submatter,old.company,old.summary,old.criteria,old.key_points,old.topics_text,old.full_text);
END;
CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts,rowid,title,matter,submatter,company,summary,criteria,key_points,topics_text,full_text)
  VALUES('delete',old.id,old.title,old.matter,old.submatter,old.company,old.summary,old.criteria,old.key_points,old.topics_text,old.full_text);
  INSERT INTO documents_fts(rowid,title,matter,submatter,company,summary,criteria,key_points,topics_text,full_text)
  VALUES(new.id,new.title,new.matter,new.submatter,new.company,new.summary,new.criteria,new.key_points,new.topics_text,new.full_text);
END;

CREATE TABLE IF NOT EXISTS topics (id INTEGER PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,parent_id INTEGER REFERENCES topics(id));
CREATE TABLE IF NOT EXISTS document_topics (document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,PRIMARY KEY(document_id,topic_id));
CREATE INDEX IF NOT EXISTS idx_document_topics_topic ON document_topics(topic_id,document_id);
CREATE TABLE IF NOT EXISTS chain_relations (id INTEGER PRIMARY KEY,chain_id TEXT NOT NULL REFERENCES procedural_chains(id) ON DELETE CASCADE,preceding_document_id INTEGER NOT NULL REFERENCES documents(id),subsequent_document_id INTEGER NOT NULL REFERENCES documents(id),relation_type TEXT NOT NULL,verified_at TEXT,UNIQUE(preceding_document_id,subsequent_document_id,relation_type));
CREATE INDEX IF NOT EXISTS idx_chain_relations_chain ON chain_relations(chain_id);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,role TEXT NOT NULL DEFAULT 'editor',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY,username TEXT NOT NULL,csrf_hash TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY,original_key TEXT NOT NULL,anonymized_key TEXT,filename TEXT NOT NULL,mime_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,sha256 TEXT NOT NULL UNIQUE,document_type TEXT,status TEXT NOT NULL DEFAULT 'PENDING_PROCESSING',privacy_status TEXT NOT NULL DEFAULT 'ANONIMIZACION_PENDIENTE',created_by TEXT NOT NULL,document_id INTEGER REFERENCES documents(id),error_message TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status,created_at);
CREATE TABLE IF NOT EXISTS privacy_reviews (id INTEGER PRIMARY KEY,upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,privacy_status TEXT NOT NULL,human_verified INTEGER NOT NULL DEFAULT 0 CHECK(human_verified IN (0,1)),residual_findings INTEGER NOT NULL DEFAULT 0,extracted_text_checked INTEGER NOT NULL DEFAULT 0,metadata_checked INTEGER NOT NULL DEFAULT 0,objects_checked INTEGER NOT NULL DEFAULT 0,images_checked INTEGER NOT NULL DEFAULT 0,ocr_layer_checked INTEGER NOT NULL DEFAULT 0,reviewer TEXT,notes TEXT,reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_privacy_reviews_upload ON privacy_reviews(upload_id,reviewed_at DESC);
CREATE TABLE IF NOT EXISTS document_versions (id INTEGER PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,version_type TEXT NOT NULL,r2_key TEXT NOT NULL,sha256 TEXT NOT NULL,privacy_status TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(document_id,sha256));
CREATE TABLE IF NOT EXISTS itss_actions (id INTEGER PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,action_type TEXT NOT NULL,itss_status TEXT NOT NULL,preceding_action_id INTEGER REFERENCES itss_actions(id),subsequent_action_id INTEGER REFERENCES itss_actions(id),verified_at TEXT);
CREATE TABLE IF NOT EXISTS guide_sections (id INTEGER PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,chapter TEXT,section TEXT,subsection TEXT,page_start INTEGER,page_end INTEGER,topic_id INTEGER REFERENCES topics(id),text TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_guide_sections_document_page ON guide_sections(document_id,page_start);
CREATE TABLE IF NOT EXISTS search_index (document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,embedding_model TEXT,embedding_json TEXT,indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,details_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type,entity_id,created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits(expires_at);

PRAGMA optimize;
