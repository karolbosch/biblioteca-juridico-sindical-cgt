#!/usr/bin/env python3
"""Reanonimiza las candidatas que la administradora devolvió a la cola."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile

from anonymize_candidates import anonymize
from sync_review_candidates import quoted, rows_from_wrangler


def run_json(command, worker_dir):
    result = subprocess.run(command, cwd=worker_dir, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=pathlib.Path, required=True)
    parser.add_argument("--worker-dir", type=pathlib.Path, default=pathlib.Path("worker"))
    parser.add_argument("--database", default="biblioteca-juridica-cgt")
    parser.add_argument("--bucket", default="biblioteca-originales-privados")
    args = parser.parse_args()
    query = "SELECT id,title,source_url,source_type,original_key,anonymized_key FROM review_candidates WHERE privacy_status='REQUIERE_REANONIMIZACION'"
    parsed = run_json(
        ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--json", "--command", query],
        args.worker_dir,
    )
    candidates = [row for row in rows_from_wrangler(parsed) if isinstance(row, dict) and row.get("id")]
    completed = []
    sql = []
    with tempfile.TemporaryDirectory() as temp_name:
        temp = pathlib.Path(temp_name)
        for candidate in candidates:
            original = temp / f"{candidate['id']}-original.pdf"
            anonymous = temp / f"{candidate['id']}-anonymized.pdf"
            subprocess.run(
                ["npx", "wrangler", "r2", "object", "get", f"{args.bucket}/{candidate['original_key']}", "--file", str(original), "--remote"],
                cwd=args.worker_dir,
                check=True,
            )
            checks = anonymize(original, anonymous)
            digest = hashlib.sha256(anonymous.read_bytes()).hexdigest()
            subprocess.run(
                ["npx", "wrangler", "r2", "object", "put", f"{args.bucket}/{candidate['anonymized_key']}", "--file", str(anonymous), "--remote"],
                cwd=args.worker_dir,
                check=True,
            )
            sql.append(
                "UPDATE review_candidates SET privacy_status='REQUIERE_REVISION', sha256_anonymized=" + quoted(digest) +
                ", automated_checks_json=" + quoted(json.dumps(checks, ensure_ascii=False)) +
                ", updated_at=CURRENT_TIMESTAMP WHERE id=" + quoted(candidate["id"]) + ";"
            )
            completed.append(candidate)
    if completed:
        with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as sql_file:
            sql_file.write("\n".join(sql))
            sql_name = sql_file.name
        subprocess.run(
            ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--file", sql_name],
            cwd=args.worker_dir,
            check=True,
        )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(completed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(completed)} candidatas reanonimizadas y devueltas a revisión")


if __name__ == "__main__":
    main()
