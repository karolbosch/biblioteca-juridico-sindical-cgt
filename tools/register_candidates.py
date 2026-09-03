#!/usr/bin/env python3
"""Convierte referencias detectadas externamente en fichas PENDING_DOWNLOAD."""
import argparse,json,pathlib
def q(value):return "'"+str(value or "").replace("'","''")+"'"
def main():
    p=argparse.ArgumentParser();p.add_argument("inbox",type=pathlib.Path);p.add_argument("--out",type=pathlib.Path);a=p.parse_args();items=json.loads(a.inbox.read_text(encoding="utf-8"));sql=[]
    for item in items:
        if not item.get("title") or not item.get("source_url"):continue
        values=[item["title"],item.get("document_type","otro"),item.get("source_type","OTRA_FUENTE"),item["source_url"],"PENDING_DOWNLOAD","FUENTE_PUBLICA_REFERENCIA","SITUACION_PROCESAL_NO_VERIFICADA",item.get("detected_at","")]
        sql.append("INSERT INTO documents(title,document_type,source_type,source_url,document_status,privacy_status,procedural_status,downloaded_at) VALUES("+",".join(map(q,values))+") ON CONFLICT DO NOTHING;")
    payload="\n".join(sql)+"\n";a.out.write_text(payload,encoding="utf-8") if a.out else print(payload,end="");print(f"{len(items)} candidatas procesadas")
if __name__=="__main__":main()
