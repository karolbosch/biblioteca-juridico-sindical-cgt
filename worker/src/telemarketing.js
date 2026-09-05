import{json}from"./http.js";
import{categorizeTopic,normalize,TOPIC_CATEGORIES}from"./search.js";
export async function telemarketingLibrary(env,headers,url){
  const{results}=await env.DB.prepare("SELECT id,title,document_type,source_type,court_level,resolution_number,date,matter,procedural_status,summary,criteria,pdf_public_path,public_path FROM documents WHERE sector='contact-center' AND privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') ORDER BY document_type, date DESC").all();
  const docs=(results||[]).map(doc=>({...doc,category:categorizeTopic(doc)}));
  const categoryFilter=url.searchParams.get("category");
  const search=String(url.searchParams.get("q")||"").trim();
  let filtered=docs;
  if(categoryFilter)filtered=filtered.filter(doc=>doc.category===categoryFilter);
  if(search){const terms=normalize(search).split(/\s+/).filter(Boolean);filtered=filtered.filter(doc=>{const text=normalize(`${doc.title} ${doc.matter} ${doc.summary} ${doc.criteria}`);return terms.every(term=>text.includes(term))})}
  const byCategory={};for(const category of TOPIC_CATEGORIES)byCategory[category.slug]=0;byCategory["otras-materias"]=0;
  for(const doc of docs)byCategory[doc.category]=(byCategory[doc.category]||0)+1;
  const categories=[...TOPIC_CATEGORIES,{slug:"otras-materias",label:"Otras materias"}].map(category=>({slug:category.slug,label:category.label,count:byCategory[category.slug]||0})).filter(category=>category.count>0);
  return json({total:docs.length,categories,documents:filtered.map(({criteria,...doc})=>doc)},200,headers)
}
