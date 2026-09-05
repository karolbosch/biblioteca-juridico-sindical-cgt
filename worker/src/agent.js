import{LEGAL_DISCLAIMER,orderSourcesForDisplay,retrieve,ruleBasedAnswer,sourcesFooter,TOPIC_CATEGORIES,categorizeTopic,isCaselaw}from"./search.js";
async function callGemini(env,system,userContent){
  const model=env.GEMINI_MODEL||"gemini-2.5-flash";
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:userContent}]}],generationConfig:{temperature:.1,maxOutputTokens:2000,thinkingConfig:{thinkingLevel:"low"}}})
  });
  if(!response.ok)throw new Error(`GEMINI_ERROR_${response.status}`);
  const data=await response.json();
  const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("")||"";
  if(!text)throw new Error("GEMINI_EMPTY_RESPONSE");
  return text
}
async function callCloudflareAI(env,system,userContent){
  if(!env.AI)throw new Error("AI_UNAVAILABLE");
  const result=await env.AI.run(env.AI_MODEL||"@cf/meta/llama-3.2-3b-instruct",{messages:[{role:"system",content:system},{role:"user",content:userContent}],temperature:.1,max_tokens:1300});
  return result.response||String(result)
}
async function callModel(env,system,userContent){
  if(env.GEMINI_API_KEY){
    for(let attempt=1;attempt<=3;attempt++){
      try{return await callGemini(env,system,userContent)}
      catch(err){if(attempt<3)await new Promise(r=>setTimeout(r,400*attempt))}
    }
    return callCloudflareAI(env,system,userContent)
  }
  return callCloudflareAI(env,system,userContent)
}
function contextOrder(source){if(source.document_type==="convenio"||source.source_type==="CONVENIO")return 0;if(source.document_type==="normativa"||source.source_type==="NORMA")return 1;if(isCaselaw(source))return 2;return 3}
function categoryLabel(slug){return TOPIC_CATEGORIES.find(c=>c.slug===slug)?.label||"Otras materias"}
export async function answerQuestion(env,question,filters={}){
  const otherSectorLabel=filters.otherSectorLabel?String(filters.otherSectorLabel).trim().slice(0,80):"";
  const sources=await retrieve(env,question,filters,12),displaySources=orderSourcesForDisplay(sources);
  if(!sources.length)return{answer:ruleBasedAnswer(question,[],otherSectorLabel),sources:[],mode:"documental"};
  const relevantSources=sources.filter(source=>source.termMatch>0).sort((a,b)=>contextOrder(a)-contextOrder(b)||b.rank-a.rank);
  if(!relevantSources.length)return{answer:ruleBasedAnswer(question,[],otherSectorLabel),sources:displaySources,mode:"documental"};
  const context=relevantSources.map((source,index)=>`[${index+1}] ${source.title}${isCaselaw(source)?` (JURISPRUDENCIA · categoría: ${categoryLabel(source.category)})`:""}\nTIPO: ${source.source_type||source.document_type||"NO CONSTA"}\nÓRGANO: ${source.court_level||"NO CONSTA"}\nESTADO: ${source.procedural_status||"SITUACIÓN PROCESAL NO VERIFICADA"}\nCRITERIO: ${source.current_rule_summary||source.criteria||source.summary||"NO CONSTA"}`).join("\n\n");
  const otherSectorInstruction=otherSectorLabel?`El usuario ha indicado que su sector es «${otherSectorLabel}», que no tiene convenio colectivo propio en esta biblioteca. Dilo expresamente al inicio de la RESPUESTA DIRECTA y responde solo con normativa laboral general (Estatuto de los Trabajadores u otra ley aplicable) y jurisprudencia general si consta en el CONTEXTO. Nunca atribuyas a ese sector un convenio de otro sector distinto.`:"";
  const system=`Responde como asistente jurídico-sindical documental español. Contesta directamente la consulta con una explicación clara y motivada; no empieces diciendo cuántos documentos hay ni describas el inventario. Solo puedes usar el CONTEXTO; no mezcles instituciones jurídicas distintas (por ejemplo, un permiso retribuido no es lo mismo que una excedencia, y una reducción de jornada no es lo mismo que una adaptación de jornada): si el CONTEXTO trata de una institución distinta a la preguntada, dilo así y no traslades sus cifras a la pregunta. ${otherSectorInstruction} Revisa el CONTEXTO en este orden: 1) primero el convenio colectivo específico del sector seleccionado, que es la respuesta práctica de partida; 2) después comprueba si el Estatuto de los Trabajadores u otra normativa general establece una condición más favorable que mejore lo que dice el convenio (el convenio nunca puede fijar condiciones por debajo de la ley); 3) por último revisa la jurisprudencia, que en el CONTEXTO aparece agrupada por categoría temática (indicada entre paréntesis junto a cada sentencia): usa solo la jurisprudencia de la categoría relacionada con la pregunta, y solo si confirma o mejora el criterio anterior. Si el CONTEXTO incluye el Estatuto, el convenio y/o una sentencia regulando el mismo supuesto con duraciones, cuantías o condiciones distintas, indica cada cifra exacta con su fuente y señala expresamente cuál se aplica por ser la más favorable para la persona trabajadora, salvo que el propio CONTEXTO indique lo contrario. No inventes números, plazos, ECLI, ROJ, fechas, artículos, empresas, recursos ni estados que no figuren literalmente en el CONTEXTO. Si falta un dato escribe exactamente: "El dato no consta en la biblioteca." Nunca presentes REVOCADA, ANULADA, CASADA_TOTALMENTE o SUPERADA_DOCTRINALMENTE como criterio vigente. Estructura la respuesta exactamente en estas secciones, cada una con su título en mayúsculas: RESPUESTA DIRECTA, EXPLICACIÓN RAZONADA, BASE LEGAL O CONVENCIONAL, CRITERIO JURISPRUDENCIAL (indica "No consta jurisprudencia específica en la biblioteca" si no hay ninguna en el CONTEXTO), CONDICIONES, EXCEPCIONES O LÍMITES, APLICACIÓN PRÁCTICA, ADVERTENCIA (sobre información no encontrada o no verificada). No sustituyes asesoramiento profesional.`;
  try{const aiText=await callModel(env,system,`PREGUNTA: ${question}\n\nCONTEXTO:\n${context}`);return{answer:`${aiText}\n\n${sourcesFooter(relevantSources)}\n\n${LEGAL_DISCLAIMER}`,sources:displaySources,mode:"ai"}}catch{return{answer:ruleBasedAnswer(question,relevantSources,otherSectorLabel),sources:displaySources,mode:"documental-fallback"}}
}
