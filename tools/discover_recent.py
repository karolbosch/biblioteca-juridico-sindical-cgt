#!/usr/bin/env python3
"""Descubre referencias recientes solo mediante feeds oficiales configurados."""
import argparse,datetime,email.utils,json,pathlib,re,urllib.request,xml.etree.ElementTree as ET
def text(node,names):
    for child in node.iter():
        if child.tag.split("}")[-1] in names and (child.text or "").strip():return child.text.strip()
    return ""
def links(node):
    found=[]
    for child in node.iter():
        if child.tag.split("}")[-1]=="link":
            value=child.attrib.get("href") or (child.text or "").strip()
            if value:found.append(value)
    return found
def main():
    p=argparse.ArgumentParser();p.add_argument("--config",type=pathlib.Path,default=pathlib.Path("data/recent_sources.json"));p.add_argument("--out",type=pathlib.Path,required=True);p.add_argument("--days",type=int,default=14);a=p.parse_args();config=json.loads(a.config.read_text(encoding="utf-8"));cutoff=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=a.days);candidates=[]
    for feed in config["feeds"]:
        if not feed.get("enabled") or not feed.get("url"):continue
        request=urllib.request.Request(feed["url"],headers={"User-Agent":"Proyecto-consultas-Juridico-Sindical/1.0 (RSS; contacto administrativo)"})
        try:root=ET.fromstring(urllib.request.urlopen(request,timeout=30).read())
        except Exception as exc:print(f"Aviso: {feed['name']}: {exc}");continue
        for item in [n for n in root.iter() if n.tag.split("}")[-1] in {"item","entry"}]:
            title=text(item,{"title"});summary=re.sub("<[^>]+>"," ",text(item,{"description","summary","content"}));hay=f"{title} {summary}".lower()
            if not any(word.lower() in hay for word in config["keywords"]):continue
            item_links=links(item);source_url=item_links[0] if item_links else "";pdf_url=next((url for url in item_links if re.search(r"\.pdf(?:$|\?)",url,re.I)),"")
            if not source_url:continue
            candidates.append({"id":__import__("hashlib").sha256(source_url.encode()).hexdigest()[:24],"title":title,"summary":" ".join(summary.split())[:2000],"source_url":source_url,"pdf_url":pdf_url,"source_type":feed["source_type"],"public_document":bool(feed.get("public_document")),"discovered_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"privacy_status":"PENDING_DOWNLOAD" if not pdf_url else ("FUENTE_PUBLICA_PENDIENTE_REVISION" if feed.get("public_document") else "ANONIMIZACION_PENDIENTE")})
    unique={item["source_url"]:item for item in candidates};a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(list(unique.values()),ensure_ascii=False,indent=2),encoding="utf-8");print(f"{len(unique)} referencias laborales recientes")
if __name__=="__main__":main()

