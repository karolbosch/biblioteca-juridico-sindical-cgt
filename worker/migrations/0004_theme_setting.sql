INSERT INTO app_settings(key,value,updated_at) VALUES ('theme','clasico',0) ON CONFLICT(key) DO NOTHING;
