import{semanticRank}from"./semantic.js";
export const ADVERSE_STATUSES=new Set(["REVOCADA","ANULADA","CASADA_TOTALMENTE","SUPERADA_DOCTRINALMENTE"]);
export const LEGAL_DISCLAIMER="AVISO\n\nEsta respuesta puede contener errores y no sustituye el asesoramiento jurídico profesional. Antes de tomar cualquier decisión, consulte a su delegado o delegada sindical, a la asesoría externa o a un/a letrado/a.";
const hierarchy={TJUE:10,TC:9,TS:8,AN:7,TSJ:6,JS:4,TI:4,ITSS:3,NORMA:9,CONVENIO:8,CRITERIO_ADMINISTRATIVO:5,CGT:2};
export function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
export function isAdverse(status){return ADVERSE_STATUSES.has(String(status||"").toUpperCase())}
const STOPWORDS=new Set(["por","una","uno","los","las","del","con","que","para","como","este","esta","estos","estas","sus","son","era","fue","ser","hay","muy","mas","más","tan","sin","tener","puedo","puede","pedir","tiempo","cuanto","cuánto","cuantos","cuántos","dias","días","meses","año","años","plazo","minimo","mínimo","maximo","máximo","legal","legales","corresponde","corresponden","correspondiente","derecho","derechos","caso","casos"]);
export function termMatchCount(doc,query){const terms=normalize(query).split(/\s+/).filter(term=>term.length>3&&!STOPWORDS.has(term)),body=normalize(`${doc.title||""} ${doc.summary||""} ${doc.criteria||""} ${doc.current_rule_summary||""}`);return terms.filter(term=>body.includes(term)).length}
export const TOPIC_CATEGORIES=[
  {slug:"jornada-horarios",label:"Jornada y horarios",keywords:["jornada","horario","descanso","turno","calendario laboral"]},
  {slug:"permisos-excedencias",label:"Permisos y excedencias",keywords:["permiso","excedencia","licencia"]},
  {slug:"vacaciones",label:"Vacaciones",keywords:["vacacion"]},
  {slug:"salario-retribucion",label:"Salario y retribución",keywords:["salari","retribu","plus","complemento","nomina","paga"]},
  {slug:"clasificacion-profesional",label:"Clasificación profesional",keywords:["clasificacion","grupo profesional","categoria profesional","nivel"]},
  {slug:"derechos-sindicales",label:"Derechos sindicales",keywords:["sindical","representacion legal","comite de empresa","delegad"]},
  {slug:"contratacion",label:"Contratación y periodo de prueba",keywords:["contrat","periodo de prueba","ingreso"]},
  {slug:"movilidad-funcional",label:"Movilidad y teletrabajo",keywords:["movilidad","teletrabajo","distancia"]},
  {slug:"disciplinario",label:"Régimen disciplinario y despido",keywords:["disciplinari","falta","sancion","despido"]},
  {slug:"seguridad-salud",label:"Seguridad y salud",keywords:["seguridad y salud","prevencion","riesgo laboral"]},
];
export function categorizeTopic(doc){const text=normalize(`${doc.title||""} ${doc.matter||""}`);for(const category of TOPIC_CATEGORIES)if(category.keywords.some(keyword=>text.includes(keyword)))return category.slug;return"otras-materias"}
export function isCaselaw(doc){return Boolean(doc.court_level)&&doc.court_level!=="CONVENIO"&&doc.court_level!=="LEY"}
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
export function sourcesFooter(sources){if(!sources||!sources.length)return"FUENTES\n\nNo se ha localizado ninguna fuente concreta en la biblioteca para esta consulta.";const lines=orderSourcesForDisplay(sources).slice(0,6).map((source,index)=>{const ref=source.resolution_number?` (${source.resolution_number})`:"";const date=source.date?` — ${source.date}`:"";return`${index+1}. ${source.title}${ref}${date}`});return`FUENTES\n\n${lines.join("\n")}`}
function ftsQuery(question){return normalize(question).split(/[^a-z0-9ñ]+/).filter(term=>term.length>2).slice(0,10).map(term=>`"${term.replace(/"/g,"")}"*`).join(" OR ")}
const fields="d.id,d.title,d.document_type,d.source_type,d.sector,d.court_level,d.resolution_number,d.date,d.year,d.company,d.matter,d.submatter,d.outcome,d.procedural_status,d.privacy_status,d.source_url,d.document_status,d.chain_id,d.final_authority,d.current_rule_summary,d.summary,d.criteria,d.pdf_public_path,d.public_path";
export async function retrieve(env,question,filters={},limit=12){
  let results=[];const terms=normalize(question).split(/\s+/).filter(term=>term.length>2);if(!terms.length)return[];const query=ftsQuery(question);
  if(query){try{({results}=await env.DB.prepare(`SELECT ${fields},bm25(documents_fts) AS text_score FROM documents_fts JOIN documents d ON d.id=documents_fts.rowid WHERE documents_fts MATCH ? AND d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') LIMIT 80`).bind(query).all())}catch{results=[]}}
  if(!results.length){({results}=await env.DB.prepare(`SELECT ${fields} FROM documents d WHERE d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') AND lower(d.search_text) LIKE ? LIMIT 300`).bind(`%${terms[0]}%`).all())}
  if(filters.sectorHint){
    try{const{results:sectorDocs}=await env.DB.prepare(`SELECT ${fields} FROM documents d WHERE d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') AND d.sector=?`).bind(filters.sectorHint).all();const known=new Set(results.map(r=>r.id));for(const doc of sectorDocs)if(!known.has(doc.id)){results.push(doc);known.add(doc.id)}}catch{}
    try{const{results:generalDocs}=await env.DB.prepare(`SELECT ${fields} FROM documents d WHERE d.privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') AND d.sector='laboral-general'`).all();const known=new Set(results.map(r=>r.id));for(const doc of generalDocs)if(!known.has(doc.id)){results.push(doc);known.add(doc.id)}}catch{}
  }
  const questionCategory=categorizeTopic({title:question});
  const lexicalScored=results.filter(doc=>(!filters.sector||doc.sector===filters.sector)&&(!filters.source_type||doc.source_type===filters.source_type)&&(!filters.otherSectorLabel||!(doc.document_type==="convenio"||doc.source_type==="CONVENIO"))).map(doc=>{let bonus=0;if(filters.sectorHint){if(doc.sector===filters.sectorHint){bonus+=8;if(filters.subsectorHint){if(doc.submatter===filters.subsectorHint)bonus+=20;else if(doc.submatter)bonus-=8}}else if(doc.sector==="laboral-general")bonus+=6;else if(doc.sector)bonus-=25}else if(doc.sector==="laboral-general")bonus+=4;const category=categorizeTopic(doc);if(isCaselaw(doc)&&category===questionCategory&&questionCategory!=="otras-materias")bonus+=6;return{...doc,category,bonus,termMatch:termMatchCount(doc,question),lexicalRank:legalRank(doc,question)+bonus}}).sort((a,b)=>b.lexicalRank-a.lexicalRank);
  const semanticCandidates=lexicalScored.slice(0,60);
  const semanticScores=filters.semantic===false?new Map():await semanticRank(env,question,semanticCandidates.map(r=>r.id)).catch(()=>new Map());
  return lexicalScored.map(doc=>{const semanticScore=semanticScores.get(doc.id)||0;const semanticBonus=semanticScore>0.32?(semanticScore-0.3)*40:0;return{...doc,semanticScore,rank:doc.lexicalRank+semanticBonus}}).sort((a,b)=>b.rank-a.rank).slice(0,Math.min(limit,30))
}
export function ruleBasedAnswer(question,sources,otherSectorLabel){
  const otherSectorNote=otherSectorLabel?`No consta en la biblioteca un convenio colectivo específico para el sector indicado («${otherSectorLabel}»). La respuesta se basa únicamente en normativa laboral general y jurisprudencia de aplicación transversal; debe verificarse si existe un convenio propio de esa actividad no incorporado aún a esta biblioteca.\n\n`:"";
  if(!sources.length)return`RESPUESTA DIRECTA\n\nNo he encontrado documentación suficiente en la biblioteca para responder con seguridad.\n\n${otherSectorNote}ADVERTENCIA\n\nEsta consulta no tiene respaldo documental verificable en la biblioteca actual.\n\n${sourcesFooter(sources)}\n\n${LEGAL_DISCLAIMER}`;
  const current=sources.filter(source=>!isAdverse(source.procedural_status)),adverse=sources.filter(source=>isAdverse(source.procedural_status)),legal=current.find(source=>source.document_type==="normativa"||source.source_type==="NORMA"),agreement=current.find(source=>source.document_type==="convenio"||source.source_type==="CONVENIO"),caselaw=current.find(source=>source.court_level&&source.court_level!=="CONVENIO"&&source.court_level!=="LEY"),criteria=current.map(source=>source.current_rule_summary||source.criteria||source.summary).filter(Boolean).slice(0,3);
  const sourcesInvolved=[legal,agreement,caselaw].filter(Boolean).length;
  const favorableNote=sourcesInvolved>1?` Ninguna de estas fuentes puede aplicarse si empeora lo que ya reconozca otra de mayor rango: compare las cifras de cada una (Estatuto, convenio y, en su caso, la sentencia citada) y aplique la más favorable para la persona trabajadora.`:"";
  return `RESPUESTA DIRECTA\n\n${criteria[0]||"La biblioteca contiene referencias relacionadas, pero no consta un criterio jurídico suficientemente desarrollado para dar una conclusión segura."}\n\nEXPLICACIÓN RAZONADA\n\n${criteria.length?criteria.join(" "):"No consta una explicación adicional verificable en la biblioteca."}\n\nBASE LEGAL O CONVENCIONAL\n\n${legal?.current_rule_summary||legal?.summary||legal?.title||"El dato no consta en la biblioteca."}${agreement?` El convenio relacionado que debe comprobarse es «${agreement.title}».`:" A falta de convenio colectivo aplicable, debe contrastarse el Estatuto de los Trabajadores."}${favorableNote}\n\nCRITERIO JURISPRUDENCIAL\n\n${caselaw?`${caselaw.title}: ${caselaw.criteria||caselaw.current_rule_summary||caselaw.summary||"criterio no detallado en la biblioteca"}.`:"No consta jurisprudencia específica sobre esta cuestión en la biblioteca."}\n\nCONDICIONES, EXCEPCIONES O LÍMITES\n\n${current[0]?.procedural_status?`Estado procesal de la fuente principal: ${current[0].procedural_status}.`:"Situación procesal no verificada."}${adverse.length?` Existen ${adverse.length} antecedentes revocados, anulados o superados que no se utilizan como criterio vigente.`:""}\n\nAPLICACIÓN PRÁCTICA\n\nLa respuesta debe contrastarse con el convenio aplicable, la documentación del caso concreto y la representación legal o asesoría correspondiente.\n\n${otherSectorNote}ADVERTENCIA\n\n${criteria.length?"Verifique siempre la vigencia de la fuente citada antes de aplicarla.":"La información disponible es limitada; no se ha podido verificar con fuentes suficientes."}\n\n${sourcesFooter(sources)}\n\n${LEGAL_DISCLAIMER}`
}



