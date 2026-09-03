#!/usr/bin/env python3
"""Sube solo candidatas nuevas a R2 privado y D1; genera la lista a notificar."""
import argparse
import json
import pathlib
import subprocess
import tempfile


def quoted(value):
    return "'" + str(value or "").replace("'", "''") + "'"


def rows_from_wrangler(value):
    rows = []
    if isinstance(value, dict):
        if isinstance(value.get("results"), list):
            rows.extend(value["results"])
        for child in value.values():
            rows.extend(rows_from_wrangler(child))
    elif isinstance(value, list):
        for child in value:
            rows.extend(rows_from_wrangler(child))
    return rows


def existing_sources(worker_dir, database):
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", database, "--remote", "--json", "--command", "SELECT source_url FROM review_candidates"],
        cwd=worker_dir,
        check=True,
        capture_output=True,
        text=True,
    )
    parsed = json.loads(result.stdout)
    return {row["source_url"] for row in rows_from_wrangler(parsed) if isinstance(row, dict) and row.get("source_url")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("prepared", type=pathlib.Path)
    parser.add_argument("--new-out", type=pathlib.Path, required=True)
    parser.add_argument("--worker-dir", type=pathlib.Path, default=pathlib.Path("worker"))
    parser.add_argument("--database", default="biblioteca-juridica-cgt")
    parser.add_argument("--bucket", default="biblioteca-originales-privados")
    args = parser.parse_args()
    items = json.loads(args.prepared.read_text(encoding="utf-8"))
    known = existing_sources(args.worker_dir, args.database)
    new_items = [item for item in items if item["source_url"] not in known]
    args.new_out.parent.mkdir(parents=True, exist_ok=True)
    args.new_out.write_text(json.dumps(new_items, ensure_ascii=False, indent=2), encoding="utf-8")
    if not new_items:
        print("No hay candidatas nuevas; no se envía ningún correo.")
        return

    sql = []
    for item in new_items:
        original_key = f"private/discovery/{item['id']}/original.pdf"
        anonymous_key = f"private/discovery/{item['id']}/anonymized-review.pdf"
        for path, key in ((item["original_path"], original_key), (item["anonymized_path"], anonymous_key)):
            subprocess.run(
                ["npx", "wrangler", "r2", "object", "put", f"{args.bucket}/{key}", "--file", str(pathlib.Path(path).resolve()), "--remote"],
                cwd=args.worker_dir,
                check=True,
            )
        values = [
            item["id"], item["title"], item.get("source_type", "OTRA_FUENTE"), item["source_url"],
            item.get("summary", ""), original_key, anonymous_key, item["sha256_original"],
            item["sha256_anonymized"], item.get("privacy_status", "REQUIERE_REVISION"),
            json.dumps(item["automated_checks"], ensure_ascii=False), item.get("discovered_at", ""),
        ]
        sql.append(
            "INSERT INTO review_candidates(id,title,source_type,source_url,summary,original_key,anonymized_key,"
            "sha256_original,sha256_anonymized,privacy_status,automated_checks_json,discovered_at) VALUES(" +
            ",".join(map(quoted, values)) + ") ON CONFLICT(source_url) DO NOTHING;"
        )
    with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as sql_file:
        sql_file.write("\n".join(sql))
        sql_name = sql_file.name
    subprocess.run(
        ["npx", "wrangler", "d1", "execute", args.database, "--remote", "--file", sql_name],
        cwd=args.worker_dir,
        check=True,
    )
    print(f"{len(new_items)} candidatas nuevas sincronizadas")


if __name__ == "__main__":
    main()

