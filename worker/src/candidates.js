import{error,json}from"./http.js";
import{isAdmin}from"./users.js";

export async function listCandidates(env,headers){
  const{results}=await env.DB.prepare("SELECT id,title,source_type,source_url,court_level,resolution_number,resolution_date,matter,summary,procedural_status,privacy_status,discovered_at FROM review_candidates WHERE published_document_id IS NULL ORDER BY discovered_at DESC LIMIT 100").all();
  return json({candidates:results},200,headers)
}

export async function candidateFile(env,headers,id){
  const row=await env.DB.prepare("SELECT anonymized_key FROM review_candidates WHERE id=?").bind(id).first();
  if(!row)return error("Candidata no encontrada",404,headers);
  const object=await env.ORIGINALS.get(row.anonymized_key);
  if(!object)return error("La copia de revisión no está disponible",404,headers);
  return new Response(object.body,{headers:{...headers,"content-type":"application/pdf","content-disposition":`inline; filename="revision-${id}.pdf"`,"etag":object.httpEtag}})
}

export async function requestReanonymization(env,headers,user,id){
  if(!isAdmin(user))return error("Solo administración puede solicitar una nueva anonimización",403,headers);
  const row=await env.DB.prepare("SELECT id,privacy_status FROM review_candidates WHERE id=? AND published_document_id IS NULL").bind(id).first();
  if(!row)return error("Candidata no encontrada",404,headers);
  if(row.privacy_status==="FUENTE_PUBLICA_REQUIERE_REVISION")return error("Una fuente pública oficial no necesita anonimización; revise su autenticidad y vigencia.",409,headers);
  await env.DB.batch([
    env.DB.prepare("UPDATE review_candidates SET privacy_status='REQUIERE_REANONIMIZACION',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id),
    env.DB.prepare("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES(?,?,?,?)").bind(user.username,"REQUEST_REANONYMIZATION","review_candidate",id)
  ]);
  return json({ok:true,privacy_status:"REQUIERE_REANONIMIZACION"},200,headers)
}

export async function confirmCandidate(request,env,headers,user,id){
  if(!isAdmin(user))return error("Solo administración puede confirmar una publicación",403,headers);
  let input={};try{input=await request.json()}catch{}
  if(input.privacy_review_confirmed!==true)return error("Debe confirmarse expresamente la revisión completa de privacidad",400,headers);
  const row=await env.DB.prepare("SELECT * FROM review_candidates WHERE id=? AND published_document_id IS NULL").bind(id).first();
  if(!row)return error("Candidata no encontrada",404,headers);
  if(row.privacy_status==="REQUIERE_REANONIMIZACION")return error("La candidata debe volver a anonimizarse antes de confirmar",409,headers);
  const object=await env.ORIGINALS.get(row.anonymized_key);
  if(!object)return error("No existe copia de revisión para publicar",409,headers);
  const isPublicSource=row.privacy_status==="FUENTE_PUBLICA_REQUIERE_REVISION";
  const publicKey=`public/${isPublicSource?"official":"anonymized"}/${id}.pdf`;
  const documentStatus=isPublicSource?"OFFICIAL_PUBLIC_COPY":"ANONYMIZED_COPY";
  await env.PUBLIC.put(publicKey,object.body,{httpMetadata:{contentType:"application/pdf"},customMetadata:{reviewedBy:user.username,sourceCandidate:id,sha256:row.sha256_anonymized||""}});
  const searchText=[row.title,row.matter,row.summary,row.court_level,row.resolution_number].filter(Boolean).join(" ");
  const inserted=await env.DB.prepare("INSERT INTO documents(document_type,title,matter,court_level,resolution_number,date,year,summary,source_url,source_type,pdf_public_path,document_status,privacy_status,procedural_status,search_text,created_at,updated_at) VALUES('sentencia',?,?,?,?,?,?,?,?,?,?,?,'PUBLICABLE',?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").bind(row.title,row.matter,row.court_level,row.resolution_number,row.resolution_date,row.resolution_date?Number(String(row.resolution_date).slice(0,4)):null,row.summary,row.source_url,row.source_type,publicKey,documentStatus,row.procedural_status||"SITUACION_PROCESAL_NO_VERIFICADA",searchText).run();
  const documentId=inserted.meta?.last_row_id;
  const updates=[
    env.DB.prepare("UPDATE review_candidates SET privacy_status='PUBLICABLE',reviewed_at=CURRENT_TIMESTAMP,reviewed_by=?,published_document_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.username,documentId,id),
    env.DB.prepare("INSERT INTO audit_log(actor,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)").bind(user.username,"CONFIRM_AND_PUBLISH_CANDIDATE","review_candidate",id,JSON.stringify({document_id:documentId,public_key:publicKey}))
  ];
  if(String(row.source_url||"").startsWith("manual-upload:"))updates.push(env.DB.prepare("UPDATE uploads SET status='PUBLICABLE',privacy_status='PUBLICABLE',document_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(documentId,row.source_url.slice("manual-upload:".length)));
  await env.DB.batch(updates);
  return json({ok:true,document_id:documentId,privacy_status:"PUBLICABLE"},201,headers)
}

export async function publicDocumentFile(env,headers,id){
  const row=await env.DB.prepare("SELECT pdf_public_path FROM documents WHERE id=? AND privacy_status='PUBLICABLE'").bind(id).first();
  if(!row?.pdf_public_path)return error("Documento no disponible",404,headers);
  const object=await env.PUBLIC.get(row.pdf_public_path);
  if(!object)return error("Documento no disponible",404,headers);
  return new Response(object.body,{headers:{...headers,"content-type":"application/pdf","content-disposition":`inline; filename="documento-${id}.pdf"`,"etag":object.httpEtag,"cache-control":"public, max-age=3600"}})
}


