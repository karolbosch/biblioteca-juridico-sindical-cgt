import{json}from"./http.js";

const RELATION_LABELS={
  CONFIRMA:"Confirma",REVOCA:"Revoca",REVOCA_PARCIALMENTE:"Revoca parcialmente",
  PROCEDE_DE:"Procede de",ACLARA:"Aclara",CORRIGE:"Corrige",CORRIGE_O_ACLARA:"Corrige o aclara",
  CITA_EXPRESA_DOCUMENTO:"Cita expresamente",MODIFICA_NORMA:"Modifica",DEROGA_NORMA:"Deroga",
  DESARROLLA_NORMA:"Desarrolla",SUCEDE_CONVENIO:"Sucede a",ACTUALIZA_TABLAS:"Actualiza tablas de",
  MISMO_PROCEDIMIENTO:"Mismo procedimiento que",MISMO_PRECEPTO:"Mismo artículo que",
  RECURSO_RELACIONADO:"Recurso relacionado con",
};
export function relationLabel(type){return RELATION_LABELS[type]||type}

export async function documentRelations(env,headers,docId){
  const{results}=await env.DB.prepare(
    `SELECT r.relation_type,r.strength,r.notes,d.id,d.doc_id,d.title,d.procedural_status,d.resolution_number
     FROM document_relations r JOIN documents d ON d.id=r.target_doc_id
     WHERE r.source_doc_id=? AND d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA')
     UNION ALL
     SELECT ('INVERSA_'||r.relation_type) as relation_type,r.strength,r.notes,d.id,d.doc_id,d.title,d.procedural_status,d.resolution_number
     FROM document_relations r JOIN documents d ON d.id=r.source_doc_id
     WHERE r.target_doc_id=? AND d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA')`
  ).bind(docId,docId).all();
  const relations=(results||[]).map(r=>({...r,label:relationLabel(r.relation_type.replace("INVERSA_",""))}));
  return json({relations},200,headers)
}

export async function documentByDocId(env,headers,docId){
  const row=await env.DB.prepare(`SELECT ${"id,doc_id,title,document_type,source_type,sector,court_level,resolution_number,date,matter,procedural_status,privacy_status,summary,criteria,current_rule_summary,page,pdf_public_path,public_path"} FROM documents WHERE doc_id=? AND privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA')`).bind(docId).first();
  if(!row)return json({error:"No encontrado"},404,headers);
  return json({document:row},200,headers)
}

export async function relationsForDocs(env,docIds){
  if(!docIds.length)return new Map();
  const placeholders=docIds.map(()=>"?").join(",");
  const{results}=await env.DB.prepare(
    `SELECT r.source_doc_id,r.relation_type,d.title,d.procedural_status FROM document_relations r
     JOIN documents d ON d.id=r.target_doc_id WHERE r.source_doc_id IN (${placeholders}) AND r.relation_type IN ('CONFIRMA','REVOCA','REVOCA_PARCIALMENTE')`
  ).bind(...docIds).all();
  const map=new Map();
  for(const row of results||[]){
    if(!map.has(row.source_doc_id))map.set(row.source_doc_id,[]);
    map.get(row.source_doc_id).push(row)
  }
  return map
}
