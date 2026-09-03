export const ADVERSE_STATUSES=new Set(["REVOCADA","ANULADA","CASADA_TOTALMENTE","SUPERADA_DOCTRINALMENTE"]);
export const LEGAL_DISCLAIMER="AVISO\n\nEsta respuesta puede contener errores y no sustituye el asesoramiento jurídico profesional. Antes de tomar cualquier decisión, consulte a su delegado o delegada sindical, a la asesoría externa o a un/a letrado/a.";
const hierarchy={TJUE:10,TC:9,TS:8,AN:7,TSJ:6,JS:4,TI:4,ITSS:3,NORMA:9,CONVENIO:8,CRITERIO_ADMINISTRATIVO:5,CGT:2};
export function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
export function isAdverse(status){return ADVERSE_STATUSES.has(String(status||"").toUpperCase())}
export function legalRank(doc,query,nowYear=new Date().getUTCFullYear()){
  const terms=normalize(query).split(/\s+/).filter(term=>term.length>2),title=normalize(doc.title),matter=normalize(`${doc.matter||""} ${doc.submatter||""} ${doc.topics||""}`),body=normalize(`${title} ${matter} ${doc.company||""} ${doc.criteria||""} ${doc.summary||""}`);
  let score=0;for(const term of terms){if(body.includes(term))score+=2;if(title.includes(term))score+=3;if(matter.includes(term))score+=4}
  score+=(hierarchy[doc.court_level]||hierarchy[doc.source_type]||1)*.7;
  const year=Number(doc.year||String(doc.date||"").slice(0,4));if(year)score+=Math.max(0,3-(nowYear-year)*.12);
  if(doc.final_authority)score+=3;if(isAdverse(doc.procedural_status))score-=20;if(["SITUACION_PROCESAL_NO_VERIFICADA","SIN_CONSTANCIA_RECURSO"].includes(doc.procedural_status))score-=2;if(doc.sector==="contact-center"&&normalize(query).includes("contact center"))score+=4;
  return score
}
function sourceOrder(doc){const title=normalize(doc.title),type=normalize(`${doc.source_type} ${doc.document_type}`);if(title.includes("estatuto de los trabajadores")||title.includes("estatuto trabajadores"))return 0;if(type.includes("convenio")||title.includes("convenio colectivo"))return 1;if(type.includes("norma")||type.includes("normativa"))return 2;if(type.includes("cgt")||type.includes("guia_doctrina")||title.includes("guia juridico sindical cgt"))return 3;if(doc.court_level||type.includes("sentencia")||type.includes("jurisprudencia"))return 4;return 5}
export function orderSourcesForDisplay(sources){return[...sources].sort((a,b)=>sourceOrder(a)-sourceOrder(b)||(b.rank||0)-(a.rank||0))}
function ftsQuery(question){return normalize(question).split(/[^a-z0-9ñ]+/).filter(term=>term.length>2).slice(0,10).map(term=>`"${term.replace(/"/g,"")}"*`).join(" OR ")}
const fields="d.id,d.title,d.document_type,d.source_type,d.sector,d.court_level,d.resolution_number,d.date,d.year,d.company,d.matter,d.submatter,d.outcome,d.procedural_status,d.privacy_status,d.source_url,d.document_status,d.chain_id,d.final_authority,d.current_rule_summary,d.summary,d.criteria,d.pdf_public_path";
export async function retrieve(env,question,filters={},limit=12){
  let results=[];const terms=normalize(question).split(/\s+/).filter(term=>term.length>2);if(!terms.length)return[];const query=ftsQuery(question);
  if(query){try{({results}=await env.DB.prepare(`SELECT ${fields},bm25(documents_fts) AS text_score FROM documents_fts JOIN documents d ON d.id=documents_fts.rowid WHERE documents_fts MATCH ? AND d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') LIMIT 80`).bind(query).all())}catch{results=[]}}
  if(!results.length){({results}=await env.DB.prepare(`SELECT ${fields} FROM documents d WHERE d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') AND lower(d.search_text) LIKE ? LIMIT 300`).bind(`%${terms[0]}%`).all())}
  return results.filter(doc=>(!filters.sector||doc.sector===filters.sector)&&(!filters.source_type||doc.source_type===filters.source_type)).map(doc=>({...doc,rank:legalRank(doc,question)})).sort((a,b)=>b.rank-a.rank).slice(0,Math.min(limit,30))
}
export function ruleBasedAnswer(question,sources){
  if(!sources.length)return`RESPUESTA\n\nNo he encontrado documentación suficiente en la biblioteca para responder con seguridad.\n\n${LEGAL_DISCLAIMER}`;
  const current=sources.filter(source=>!isAdverse(source.procedural_status)),adverse=sources.filter(source=>isAdverse(source.procedural_status)),legal=current.find(source=>source.document_type==="normativa"||source.source_type==="NORMA"),agreement=current.find(source=>source.document_type==="convenio"||source.source_type==="CONVENIO"),criteria=current.map(source=>source.current_rule_summary||source.criteria||source.summary).filter(Boolean).slice(0,3);
  return `RESPUESTA\n\n${criteria.length?criteria.join(" "):"La biblioteca contiene referencias relacionadas, pero no consta un criterio jurídico suficientemente desarrollado para dar una conclusión segura."}\n\nBASE LEGAL\n\n${legal?.current_rule_summary||legal?.summary||legal?.title||"El dato no consta en la biblioteca."}${agreement?` El convenio relacionado que debe comprobarse es «${agreement.title}».`:" A falta de convenio colectivo aplicable, debe contrastarse el Estatuto de los Trabajadores."}\n\nCRITERIO JURÍDICO\n\n${current[0]?.criteria||current[0]?.current_rule_summary||current[0]?.summary||"El criterio detallado no consta en la biblioteca."}\n\nESTADO PROCESAL\n\n${current[0]?.procedural_status||"Situación procesal no verificada."}${adverse.length?` Existen ${adverse.length} antecedentes revocados, anulados o superados que no se utilizan como criterio vigente.`:""}\n\nAPLICACIÓN PRÁCTICA\n\nLa respuesta debe contrastarse con el convenio aplicable, la documentación del caso y la representación legal o asesoría correspondiente.\n\n${LEGAL_DISCLAIMER}`
}



