#!/usr/bin/env python3
import argparse,json,pathlib,sys
ADVERSE={"REVOCADA","ANULADA","CASADA_TOTALMENTE","SUPERADA_DOCTRINALMENTE"}
def main():
    p=argparse.ArgumentParser();p.add_argument("documents",type=pathlib.Path);a=p.parse_args();docs=json.loads(a.documents.read_text(encoding="utf-8"));errors=[]
    by_id={str(d.get("id")):d for d in docs}
    for d in docs:
        if d.get("chain_id") and not (d.get("preceding_case_ids") or d.get("subsequent_case_ids") or d.get("final_authority")):errors.append(f"{d.get('id')}: cadena sin relaciones ni autoridad final")
        if d.get("procedural_status") in ADVERSE and not d.get("subsequent_case_ids"):errors.append(f"{d.get('id')}: estado adverso sin resolución posterior enlazada")
    print(json.dumps({"documents":len(docs),"errors":errors},ensure_ascii=False));sys.exit(1 if errors else 0)
if __name__=="__main__":main()
