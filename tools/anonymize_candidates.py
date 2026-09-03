#!/usr/bin/env python3
"""Descarga PDFs directos permitidos, elimina patrones inequívocos y genera copias de revisión.

Nunca marca una copia como publicable: nombres, imágenes, OCR y contexto requieren revisión humana.
"""
import argparse,hashlib,json,pathlib,re,shutil,urllib.parse,urllib.request
import fitz
PATTERNS=[("DNI",r"\b\d{8}[A-Z]\b"),("NIE",r"\b[XYZ]\d{7}[A-Z]\b"),("IBAN",r"\bES\d{22}\b"),("EMAIL",r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),("TELÉFONO",r"\b(?:\+34\s*)?[6789]\d{8}\b"),("SEGURIDAD_SOCIAL",r"\b\d{12}\b")]
ALLOWED={"curia.europa.eu","eur-lex.europa.eu","tribunalconstitucional.es","www.tribunalconstitucional.es","poderjudicial.es","www.poderjudicial.es"}
def download(url,target):
    host=urllib.parse.urlparse(url).hostname or ""
    if host not in ALLOWED:raise ValueError(f"Host no autorizado: {host}")
    request=urllib.request.Request(url,headers={"User-Agent":"Proyecto-consultas-Juridico-Sindical/1.0"});data=urllib.request.urlopen(request,timeout=60).read(30*1024*1024)
    if not data.startswith(b"%PDF-"):raise ValueError("El recurso no es un PDF válido")
    target.write_bytes(data);return hashlib.sha256(data).hexdigest()
def anonymize(source,target):
    doc=fitz.open(source);findings=[];has_images=False
    for page_no,page in enumerate(doc):
        has_images=has_images or bool(page.get_images(full=True));text=page.get_text("text")
        for kind,pattern in PATTERNS:
            for match in re.finditer(pattern,text,re.I):
                for rect in page.search_for(match.group(0)):page.add_redact_annot(rect,fill=(0,0,0));findings.append({"page":page_no+1,"type":kind})
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
    doc.set_metadata({});doc.scrub(attached_files=True,embedded_files=True,hidden_text=True,javascript=True,metadata=True,redactions=True,remove_links=False,reset_fields=True,reset_responses=True,thumbnails=True,xml_metadata=True);doc.save(target,garbage=4,clean=True,deflate=True);doc.close()
    verify=fitz.open(target);residual="\n".join(page.get_text("text") for page in verify);verify.close();residual_counts={kind:len(re.findall(pattern,residual,re.I)) for kind,pattern in PATTERNS}
    return{"redactions":findings,"residual_counts":residual_counts,"contains_images":has_images,"privacy_status":"REQUIERE_REVISION","human_checks_required":["nombres y apellidos","texto extraído","metadatos","objetos","imágenes","capa OCR"]}
def main():
    p=argparse.ArgumentParser();p.add_argument("candidates",type=pathlib.Path);p.add_argument("--out",type=pathlib.Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True);items=json.loads(a.candidates.read_text(encoding="utf-8"));prepared=[]
    for item in items:
        if not item.get("pdf_url"):continue
        folder=a.out/item["id"];folder.mkdir(parents=True,exist_ok=True);original=folder/"original.pdf";anonymous=folder/("public-review.pdf" if item.get("public_document") else "anonymized-review.pdf")
        try:
            sha_original=download(item["pdf_url"],original)
            if item.get("public_document"):
                shutil.copyfile(original,anonymous);checks={"privacy_status":"FUENTE_PUBLICA_REQUIERE_REVISION","public_source":True,"human_checks_required":["autenticidad de la fuente","vigencia","clasificación jurídica"]}
            else:checks=anonymize(original,anonymous)
        except Exception as exc:item["error"]=str(exc);continue
        item.update({"original_path":str(original),"anonymized_path":str(anonymous),"sha256_original":sha_original,"sha256_anonymized":hashlib.sha256(anonymous.read_bytes()).hexdigest(),"automated_checks":checks,"privacy_status":checks["privacy_status"]});prepared.append(item)
    (a.out/"prepared.json").write_text(json.dumps(prepared,ensure_ascii=False,indent=2),encoding="utf-8");print(f"{len(prepared)} copias preparadas para revisión humana")
if __name__=="__main__":main()

