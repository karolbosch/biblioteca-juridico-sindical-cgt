const MODEL="@cf/baai/bge-m3";

export function embeddingText(doc){
  const parts=[doc.title,doc.summary,doc.criteria||doc.current_rule_summary].filter(Boolean).join(". ");
  return parts.slice(0,1800);
}

export async function embed(env,text){
  const result=await env.AI.run(MODEL,{text:[text]});
  return result?.data?.[0]||null;
}

export function cosineSimilarity(a,b){
  let dot=0,normA=0,normB=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];normA+=a[i]*a[i];normB+=b[i]*b[i]}
  if(!normA||!normB)return 0;
  return dot/(Math.sqrt(normA)*Math.sqrt(normB));
}

export async function embedMissingBatch(env,headers,json,limit=25){
  const{results}=await env.DB.prepare("SELECT d.id,d.title,d.summary,d.criteria,d.current_rule_summary FROM documents d LEFT JOIN document_embeddings e ON e.document_id=d.id WHERE e.document_id IS NULL AND d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') LIMIT ?").bind(limit).all();
  let done=0;
  for(const doc of results||[]){
    try{
      const vector=await embed(env,embeddingText(doc));
      if(vector)await env.DB.prepare("INSERT INTO document_embeddings(document_id,embedding,updated_at) VALUES(?,?,unixepoch()) ON CONFLICT(document_id) DO UPDATE SET embedding=excluded.embedding,updated_at=excluded.updated_at").bind(doc.id,JSON.stringify(vector)).run();
      done++;
    }catch(e){}
  }
  const{count}=await env.DB.prepare("SELECT count(*) as count FROM documents d LEFT JOIN document_embeddings e ON e.document_id=d.id WHERE e.document_id IS NULL AND d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA')").first();
  return json({processed:done,remaining:count},200,headers)
}

export async function semanticRank(env,question,candidateIds){
  if(!candidateIds.length)return new Map();
  let questionVector;
  try{questionVector=await embed(env,question)}catch{return new Map()}
  if(!questionVector)return new Map();
  const placeholders=candidateIds.map(()=>"?").join(",");
  const{results}=await env.DB.prepare(`SELECT document_id,embedding FROM document_embeddings WHERE document_id IN (${placeholders})`).bind(...candidateIds).all();
  const scores=new Map();
  for(const row of results||[]){
    try{const vector=JSON.parse(row.embedding);scores.set(row.document_id,cosineSimilarity(questionVector,vector))}catch{}
  }
  return scores
}
