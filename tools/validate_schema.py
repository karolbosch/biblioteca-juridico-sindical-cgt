#!/usr/bin/env python3
import pathlib,sqlite3
migrations=pathlib.Path(__file__).parents[1]/"worker/migrations"
db=sqlite3.connect(":memory:")
for migration in sorted(migrations.glob("*.sql")):db.executescript(migration.read_text(encoding="utf-8"))
tables={r[0] for r in db.execute("select name from sqlite_schema where type in ('table','view')")};required={"documents","documents_fts","procedural_chains","uploads","privacy_reviews","audit_log","users","review_candidates"};missing=required-tables
if missing:raise SystemExit(f"Faltan tablas: {sorted(missing)}")
print(f"Esquema válido: {len(tables)} tablas/índices virtuales")
