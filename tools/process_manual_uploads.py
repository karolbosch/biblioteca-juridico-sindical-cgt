#!/usr/bin/env python3
"""Anonimiza PDFs subidos manualmente y los lleva al panel de revisión."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile

from anonymize_candidates import anonymize
from sync_review_candidates import quoted, rows_from_wrangler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=pathlib.Path, required=True)
    parser.add_argument("--worker-dir", type=pathlib.Path, default=pathlib.Path("worker"))
    parser.add_argument("--database", default="biblioteca-juridica-cgt")
    parser.add_argument("--bucket", default="biblioteca-originales-privados")
    args = parser.parse_args()
    query = "SELECT id,title,matter,court_level,resolution_number,resolution_date,procedural_status,notes,original_key,mime_type FROM uploads WHERE status='PENDING_PROCESSING' AND document_type='sentencia' AND mime_type='application/pdf'"
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--json", "--command", query],
        cwd=args.worker_dir, check=True, capture_output=True, text=True,
    )
    uploads = [row for row in rows_from_wrangler(json.loads(result.stdout)) if isinstance(row, dict) and row.get("id")]
    completed = []
    sql = []
    with tempfile.TemporaryDirectory() as temp_name:
        temp = pathlib.Path(temp_name)
        for upload in uploads:
            candidate_id = f"manual-{upload['id']}"
            original = temp / f"{candidate_id}-original.pdf"
            anonymous = temp / f"{candidate_id}-anonymized.pdf"
            anonymous_key = f"private/manual/{upload['id']}/anonymized-review.pdf"
            subprocess.run(
                ["npx", "wrangler", "r2", "object", "get", f"{args.bucket}/{upload['original_key']}", "--file", str(original), "--remote"],
                cwd=args.worker_dir, check=True,
            )
            checks = anonymize(original, anonymous)
            digest = hashlib.sha256(anonymous.read_bytes()).hexdigest()
            subprocess.run(
                ["npx", "wrangler", "r2", "object", "put", f"{args.bucket}/{anonymous_key}", "--file", str(anonymous), "--remote"],
                cwd=args.worker_dir, check=True,
            )
            values = [
                candidate_id, upload["title"], "APORTACION_MANUAL", f"manual-upload:{upload['id']}", upload.get("court_level"),
                upload.get("resolution_number"), upload.get("resolution_date"), upload.get("matter"), upload.get("notes"),
                upload.get("procedural_status") or "SITUACION_PROCESAL_NO_VERIFICADA", upload["original_key"], anonymous_key,
                digest, json.dumps(checks, ensure_ascii=False),
            ]
            sql.append(
                "INSERT INTO review_candidates(id,title,source_type,source_url,court_level,resolution_number,resolution_date,matter,summary,"
                "procedural_status,original_key,anonymized_key,sha256_anonymized,automated_checks_json,privacy_status) VALUES(" +
                ",".join(map(quoted, values)) + ",'REQUIERE_REVISION') ON CONFLICT(source_url) DO NOTHING;"
            )
            sql.append("UPDATE uploads SET status='REQUIERE_REVISION',privacy_status='REQUIERE_REVISION',anonymized_key=" + quoted(anonymous_key) + ",updated_at=CURRENT_TIMESTAMP WHERE id=" + quoted(upload["id"]) + ";")
            completed.append({"id": candidate_id, "title": upload["title"]})
    if completed:
        with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as sql_file:
            sql_file.write("\n".join(sql))
            sql_name = sql_file.name
        subprocess.run(
            ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--file", sql_name],
            cwd=args.worker_dir, check=True,
        )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(completed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(completed)} subidas manuales preparadas para revisión")


if __name__ == "__main__":
    main()
