#!/usr/bin/env python3
"""Auditoría conservadora: informa; nunca declara un PDF publicable automáticamente."""
import argparse, hashlib, json, pathlib, re, shutil, subprocess, tempfile
PATTERNS={"DNI":r"\b\d{8}[A-Z]\b","NIE":r"\b[XYZ]\d{7}[A-Z]\b","IBAN":r"\bES\d{22}\b","EMAIL":r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}","TELEFONO":r"\b(?:\+34\s*)?[6789]\d{8}\b"}
def run_tool(args):
    try:return subprocess.run(args,capture_output=True,text=True,timeout=120,check=False).stdout
    except (FileNotFoundError,subprocess.TimeoutExpired):return ""
def audit(path):
    raw=path.read_bytes();text="";metadata="";tools={"pdftotext":bool(shutil.which("pdftotext")),"pdfinfo":bool(shutil.which("pdfinfo")),"qpdf":bool(shutil.which("qpdf"))}
    with tempfile.TemporaryDirectory() as temp:
        txt=pathlib.Path(temp)/"text.txt"
        if tools["pdftotext"]:subprocess.run(["pdftotext","-layout",str(path),str(txt)],capture_output=True,timeout=120);text=txt.read_text(errors="replace") if txt.exists() else ""
    if tools["pdfinfo"]:metadata=run_tool(["pdfinfo",str(path)])
    findings={name:len(re.findall(pattern,text,re.I)) for name,pattern in PATTERNS.items()}
    risky_metadata=[line for line in metadata.splitlines() if line.lower().startswith(("author:","creator:","subject:")) and line.split(":",1)[-1].strip()]
    complete=all(tools.values()) and bool(text)
    return {"file":str(path),"sha256":hashlib.sha256(raw).hexdigest(),"tools":tools,"text_extracted":bool(text),"findings":findings,"risky_metadata":risky_metadata,"privacy_status":"REQUIERE_REVISION","publicable":False,"audit_complete":complete,"reason":"La verificación humana y la inspección de imágenes/OCR/objetos son obligatorias."}
def main():
    p=argparse.ArgumentParser();p.add_argument("pdf",type=pathlib.Path);p.add_argument("--out",type=pathlib.Path);a=p.parse_args();report=audit(a.pdf);payload=json.dumps(report,ensure_ascii=False,indent=2);a.out.write_text(payload,encoding="utf-8") if a.out else print(payload)
if __name__=="__main__":main()
