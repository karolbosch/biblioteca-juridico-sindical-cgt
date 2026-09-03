#!/usr/bin/env python3
"""Inventaría JSON/CSV/carpetas, detecta duplicados y genera SQL + manifiesto R2.

No publica nada: los originales se planifican siempre bajo private/originals/ y las
copias públicas solo si el metadato privacy_status es ANONIMIZACION_VERIFICADA.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, mimetypes, pathlib, sqlite3, subprocess, sys

FIELDS = ["title","document_type","sector","court_level","resolution_number","date","year","company","matter","outcome","procedural_status","privacy_status","source_url","source_type","document_status","chain_id","final_authority","current_rule_summary","summary","criteria","ecli","roj","case_number","appeal_number"]

def sha256(path: pathlib.Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def load_metadata(path: pathlib.Path):
    if path.suffix.lower()==".json":
        data=json.loads(path.read_text(encoding="utf-8-sig")); return data if isinstance(data,list) else data.get("documents",[])
    if path.suffix.lower()==".csv":
        with path.open(encoding="utf-8-sig",newline="") as stream:return list(csv.DictReader(stream))
    raise ValueError("Los metadatos deben ser JSON o CSV")

def scan_files(root: pathlib.Path):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in {".pdf",".zip"}:
            digest=sha256(path); public="anonimizad" in str(path).lower()
            yield {"path":str(path),"filename":path.name,"sha256":digest,"size":path.stat().st_size,"mime":mimetypes.guess_type(path.name)[0] or "application/octet-stream","r2_key":f"private/originals/{digest[:2]}/{digest}/{path.name}","privacy_status":"REQUIERE_REVISION" if public else "ANONIMIZACION_PENDIENTE","public_candidate":public}

def quote(value): return "'"+str(value or "").replace("'","''")+"'"
# chain_id es FOREIGN KEY REFERENCES procedural_chains(id): una cadena vacía ('')
# no es NULL para SQLite/D1 y provoca SQLITE_CONSTRAINT_FOREIGNKEY. Debe insertarse
# NULL cuando no hay cadena procesal registrada todavía.
NULLABLE_FK_FIELDS = {"chain_id"}
def sql_value(col, value):
    if col in NULLABLE_FK_FIELDS and not value: return "NULL"
    return quote(value)
def sql_for(rows):
    output=[]
    for row in rows:
        values={field:row.get(field,"") for field in FIELDS}
        if not values["title"]: continue
        values["document_type"]=values["document_type"] or row.get("type") or "otro"
        values["source_type"]=values["source_type"] or "OTRA_FUENTE"
        values["document_status"]=values["document_status"] or "FICHA"
        values["privacy_status"]=values["privacy_status"] or "ANONIMIZACION_PENDIENTE"
        values["procedural_status"]=values["procedural_status"] or "SITUACION_PROCESAL_NO_VERIFICADA"
        search=" ".join(str(values.get(k) or "") for k in ("title","matter","company","criteria","summary"))
        cols=FIELDS+["search_text"]
        output.append(f"INSERT INTO documents ({','.join(cols)}) VALUES ({','.join(sql_value(c, search if c=='search_text' else values.get(c)) for c in cols)}) ON CONFLICT DO NOTHING;")
    output.extend(["INSERT INTO documents_fts(documents_fts) VALUES('rebuild');","PRAGMA optimize;"])
    return "\n".join(output)+"\n"

def upload_manifest(manifest,worker_dir):
    for item in manifest:
        bucket="biblioteca-anonimizados-publicos" if item["r2_key"].startswith("public/") else "biblioteca-originales-privados"
        subprocess.run(["npx","wrangler","r2","object","put",f"{bucket}/{item['r2_key']}","--file",item["path"],"--remote"],cwd=worker_dir,check=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--metadata",type=pathlib.Path);parser.add_argument("--files",type=pathlib.Path);parser.add_argument("--out",type=pathlib.Path,default=pathlib.Path("data/import"));parser.add_argument("--upload-r2",action="store_true");parser.add_argument("--worker-dir",type=pathlib.Path,default=pathlib.Path("worker"));args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True);rows=load_metadata(args.metadata) if args.metadata else [];manifest=list(scan_files(args.files)) if args.files else []
    duplicates={};
    for item in manifest:duplicates.setdefault(item["sha256"],[]).append(item["path"])
    report={"metadata_rows":len(rows),"files":len(manifest),"duplicate_groups":[paths for paths in duplicates.values() if len(paths)>1],"public_candidates_blocked":sum(i["public_candidate"] for i in manifest)}
    (args.out/"seed.sql").write_text(sql_for(rows),encoding="utf-8");(args.out/"r2-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8");(args.out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    if args.upload_r2:upload_manifest(manifest,args.worker_dir)
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
