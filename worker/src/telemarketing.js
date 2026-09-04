import{json}from"./http.js";
const CATEGORIES=[
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
function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function categorize(doc){const text=normalize(`${doc.title} ${doc.matter||""}`);for(const category of CATEGORIES)if(category.keywords.some(keyword=>text.includes(keyword)))return category.slug;return"otras-materias"}
export async function telemarketingLibrary(env,headers,url){
  const{results}=await env.DB.prepare("SELECT id,title,document_type,source_type,court_level,resolution_number,date,matter,procedural_status,summary,criteria,pdf_public_path,public_path FROM documents WHERE sector='contact-center' AND privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') ORDER BY document_type, date DESC").all();
  const docs=(results||[]).map(doc=>({...doc,category:categorize(doc)}));
  const categoryFilter=url.searchParams.get("category");
  const search=String(url.searchParams.get("q")||"").trim();
  let filtered=docs;
  if(categoryFilter)filtered=filtered.filter(doc=>doc.category===categoryFilter);
  if(search){const terms=normalize(search).split(/\s+/).filter(Boolean);filtered=filtered.filter(doc=>{const text=normalize(`${doc.title} ${doc.matter} ${doc.summary} ${doc.criteria}`);return terms.every(term=>text.includes(term))})}
  const byCategory={};for(const category of CATEGORIES)byCategory[category.slug]=0;byCategory["otras-materias"]=0;
  for(const doc of docs)byCategory[doc.category]=(byCategory[doc.category]||0)+1;
  const categories=[...CATEGORIES,{slug:"otras-materias",label:"Otras materias"}].map(category=>({slug:category.slug,label:category.label,count:byCategory[category.slug]||0})).filter(category=>category.count>0);
  return json({total:docs.length,categories,documents:filtered.map(({criteria,...doc})=>doc)},200,headers)
}
