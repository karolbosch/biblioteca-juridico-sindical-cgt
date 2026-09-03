#!/usr/bin/env python3
"""Envía a la cuenta revisora enlaces directos; requiere contraseña de aplicación SMTP."""
import argparse,email.message,html,json,os,pathlib,smtplib
def main():
    p=argparse.ArgumentParser();p.add_argument("prepared",type=pathlib.Path);a=p.parse_args();items=json.loads(a.prepared.read_text(encoding="utf-8"));
    if not items:return
    sender=os.environ["SMTP_USERNAME"];password=os.environ["SMTP_APP_PASSWORD"];recipient=os.environ["REVIEW_EMAIL"];base=os.environ["PUBLIC_APP_URL"].rstrip("/")
    rows="".join(f'<li><a href="{html.escape(base)}/admin/#candidate-{html.escape(str(item["id"]))}">{html.escape(item["title"])}</a></li>' for item in items);message=email.message.EmailMessage();message["Subject"]=f"{len(items)} sentencias pendientes de verificar";message["From"]=sender;message["To"]=recipient;message.set_content("Hay nuevas sentencias pendientes de revisión en el panel privado.");message.add_alternative(f"<h1>Sentencias pendientes de verificación</h1><p>Inicia sesión como administradora para revisar cada copia anonimizada.</p><ol>{rows}</ol>",subtype="html")
    with smtplib.SMTP_SSL("smtp.gmail.com",465) as smtp:smtp.login(sender,password);smtp.send_message(message)
    print(f"Notificación enviada con {len(items)} enlaces")
if __name__=="__main__":main()
