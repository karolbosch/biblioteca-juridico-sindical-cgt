import{detectFile,digestHex,safeFilename}from"./security.js";
import{initialPrivacyStatus,mayPublish}from"./privacy.js";
import{error,json}from"./http.js";
import{getSetting}from"./settings.js";

export async function receiveUpload(request,env,headers,user){
  const form=await request.formData(),file=form.get("file"),documentType=String(form.get("document_type")||"sentencia"),title=String(form.get("title")||"").trim();
  if(!file||typeof file.arrayBuffer!=="function")return error("Falta el archivo",400,headers);
  if(documentType==="sentencia"&&!title)return error("El título de la sentencia es obligatorio",400,headers);
  const max=Number(await getSetting(env,"max_upload_bytes",env.MAX_UPLOAD_BYTES||20971520));
  if(file.size>max)return error(`El archivo supera el límite de ${Math.floor(max/1048576)} MB`,413,headers);
  const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer),kind=detectFile(bytes,file.type,file.name);
  if(!kind)return error("El contenido no coincide con un PDF o ZIP válido",415,headers);
  const sha=await digestHex(buffer),duplicate=await env.DB.prepare("SELECT id FROM uploads WHERE sha256=? LIMIT 1").bind(sha).first();
  if(duplicate)return json({error:"DUPLICADO",duplicate_id:duplicate.id},409,headers);
  const id=crypto.randomUUID(),name=safeFilename(file.name),key=`private/originals/${new Date().toISOString().slice(0,10)}/${id}/${name}`,privacy=initialPrivacyStatus(kind);
  await env.ORIGINALS.put(key,buffer,{httpMetadata:{contentType:kind==="pdf"?"application/pdf":"application/zip"},customMetadata:{sha256:sha,originalName:name}});
  await env.DB.prepare("INSERT INTO uploads(id,original_key,filename,mime_type,size_bytes,sha256,document_type,status,privacy_status,created_by,title,matter,court_level,resolution_number,resolution_date,procedural_status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,key,name,file.type,file.size,sha,documentType,"PENDING_PROCESSING",privacy,user.username,title,String(form.get("matter")||"").slice(0,120),String(form.get("court_level")||"").slice(0,20),String(form.get("resolution_number")||"").slice(0,80),String(form.get("resolution_date")||"").slice(0,10),String(form.get("procedural_status")||"SITUACION_PROCESAL_NO_VERIFICADA").slice(0,50),String(form.get("notes")||"").slice(0,1000)).run();
  await env.DB.prepare("INSERT INTO audit_log(actor,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)").bind(user.username,"UPLOAD_PRIVATE_ORIGINAL","upload",id,JSON.stringify({filename:name,sha256:sha,kind,title})).run();
  return json({id,status:"PENDING_PROCESSING",privacy_status:privacy},201,headers)
}

export async function publishVersion(request,env,headers,user,id){
    const review=await env.DB.prepare("SELECT * FROM privacy_reviews WHERE upload_id=? ORDER BY reviewed_at DESC LIMIT 1").bind(id).first();
    if(!mayPublish(review))return error("Publicación bloqueada: falta anonimización verificada por una persona y auditoría residual limpia",409,headers);
    const upload=await env.DB.prepare("SELECT * FROM uploads WHERE id=?").bind(id).first();
    if(!upload?.anonymized_key)return error("No existe copia anonimizada",409,headers);
    await env.DB.prepare("UPDATE uploads SET status='PUBLICABLE',privacy_status='PUBLICABLE' WHERE id=?").bind(id).run();
    await env.DB.prepare("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES(?,?,?,?)").bind(user.username,"PUBLISH_APPROVED_ANONYMIZED_COPY","upload",id).run();
    return json({ok:true,status:"PUBLICABLE"},200,headers)
}
