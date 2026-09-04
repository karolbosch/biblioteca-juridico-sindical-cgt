CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
INSERT INTO app_settings(key,value,updated_at) VALUES ('app_name','Proyecto consultas Jurídico/Sindical',0) ON CONFLICT(key) DO NOTHING;
INSERT INTO app_settings(key,value,updated_at) VALUES ('default_page_size','12',0) ON CONFLICT(key) DO NOTHING;
INSERT INTO app_settings(key,value,updated_at) VALUES ('max_upload_bytes','20971520',0) ON CONFLICT(key) DO NOTHING;
