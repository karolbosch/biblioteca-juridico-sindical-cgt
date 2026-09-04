import{answerQuestion}from"./agent.js";
import{createSession,destroySession,requireSession}from"./auth.js";
import{candidateFile,confirmCandidate,listCandidates,publicDocumentFile,requestReanonymization}from"./candidates.js";
import{assertAllowedOrigin,cors,error,json,readJson}from"./http.js";
import{rateLimit}from"./security.js";
import{publishVersion,receiveUpload}from"./uploads.js";
import{canAccessTelemarketing,canUpload,createUser,isAdmin,listUsers}from"./users.js";
import{adminGetSettings,adminUpdateSettings,publicSettings}from"./settings.js";
import{listHistory,recordQuery}from"./history.js";
import{telemarketingLibrary}from"./telemarketing.js";

async function audit(env,actor,action,entityType,entityId,details={}){await env.DB.prepare("INSERT INTO audit_log(actor,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)").bind(actor,action,entityType,entityId,JSON.stringify(details)).run()}

const SECTOR_LABELS={"contact-center":"Contact Center / Telemarketing","servicios":"Servicios (seguridad, limpieza, jardinería, taxi…)","construccion-metal-industria":"Construcción, Metal e Industria","comercio-finanzas-seguros":"Comercio, Banca y Seguros","social-dependencia-ensenanza":"Social, Dependencia y Enseñanza","hosteleria-turismo-alimentacion":"Hostelería, Turismo y Alimentación"};
const SUBSECTOR_LABELS={"jardineria":"Jardinería","mantenimiento-instalaciones-acuaticas":"Instalaciones acuáticas","servicios-auxiliares":"Servicios auxiliares (recepción/control accesos)","autoescuelas":"Autoescuelas","auto-taxis":"Auto-Taxis","bingo":"Salas de bingo","peluquerias-gimnasios":"Peluquerías y gimnasios","seguridad-privada":"Seguridad privada","artes-graficas":"Artes gráficas","curtidos-peleteria":"Curtidos y peletería","textil-confeccion":"Textil y confección","pastas-papel-carton":"Pastas, papel y cartón","construccion":"Construcción","industria-quimica":"Industria química","metal":"Metal","industrias-extractivas-vidrio-ceramica":"Extractivas, vidrio y cerámica","atencion-discapacidad":"Atención a la discapacidad","ensenanza-privada-concertada":"Enseñanza privada concertada","atencion-dependencia":"Atención a la dependencia","ocio-educativo":"Ocio educativo","reforma-juvenil":"Reforma juvenil","accion-social":"Acción social","seguros":"Seguros","cooperativas-credito":"Cooperativas de crédito","banca":"Banca","cajas-ahorro":"Cajas de ahorro","establecimientos-financieros":"Establecimientos financieros de crédito","grandes-almacenes":"Grandes almacenes"};
async function listSectors(env,headers){
  const{results}=await env.DB.prepare("SELECT sector, submatter, count(*) c FROM documents WHERE privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') AND sector IS NOT NULL AND sector!='' AND sector NOT IN ('laboral-general','catalogos') GROUP BY sector, submatter ORDER BY sector, c DESC").all();
  const bySector=new Map();
  for(const row of results||[]){
    if(!bySector.has(row.sector))bySector.set(row.sector,{value:row.sector,label:SECTOR_LABELS[row.sector]||row.sector,count:0,subsectors:[]});
    const entry=bySector.get(row.sector);entry.count+=row.c;
    if(row.submatter)entry.subsectors.push({value:row.submatter,label:SUBSECTOR_LABELS[row.submatter]||row.submatter,count:row.c});
  }
  const sectors=[...bySector.values()].sort((a,b)=>b.count-a.count);
  return json({sectors},200,headers)
}

export async function route(request,env){
  const url=new URL(request.url),headers=cors(env,request);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(!assertAllowedOrigin(request,env))return error("Origen no permitido",403,headers);
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  if(!await rateLimit(env,`${ip}:${url.pathname}`,url.pathname==="/api/ask"?20:60,60))return error("Demasiadas solicitudes",429,{...headers,"retry-after":"60"});
  if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,ai:Boolean(env.AI),fallback:true,pwa:true},200,headers);
  if(url.pathname==="/api/auth/login"&&request.method==="POST")return createSession(request,env,headers);
  if(url.pathname==="/api/auth/logout"&&request.method==="POST")return destroySession(request,env,headers);
  if(url.pathname==="/api/ask"&&request.method==="POST"){
    let body;try{body=await readJson(request)}catch{return error("Petición inválida",400,headers)}
    const question=String(body.question||"").trim();
    if(question.length<3||question.length>1200)return error("La pregunta debe tener entre 3 y 1200 caracteres",400,headers);
    const answer=await answerQuestion(env,question,body.filters||{});
    const sessionUser=await requireSession(request,env,false);
    if(sessionUser)await recordQuery(env,sessionUser,question,answer.answer,answer.mode);
    return json(answer,200,headers)
  }
  if(url.pathname==="/api/me"&&request.method==="GET"){
    const sessionUser=await requireSession(request,env,false);
    if(!sessionUser)return json({authenticated:false},200,headers);
    return json({authenticated:true,username:sessionUser.username,role:sessionUser.role,sector:sessionUser.sector||null,telemarketing_access:Boolean(sessionUser.telemarketing_access)},200,headers)
  }
  if(url.pathname==="/api/telemarketing-library"&&request.method==="GET"){
    const sessionUser=await requireSession(request,env,false);
    if(!sessionUser||!canAccessTelemarketing(sessionUser))return error("No autorizado",403,headers);
    return telemarketingLibrary(env,headers,url)
  }
  if(url.pathname==="/api/documents"&&request.method==="GET"){
    const{results}=await env.DB.prepare("SELECT id,title,document_type,source_type,sector,court_level,resolution_number,date,matter,procedural_status,privacy_status,source_url,chain_id,final_authority,summary,pdf_public_path FROM documents WHERE privacy_status IN ('PUBLICABLE','ANONIMIZACION_VERIFICADA') ORDER BY date DESC LIMIT 200").all();
    return json({documents:results},200,headers)
  }
  const publicFile=url.pathname.match(/^\/api\/documents\/(\d+)\/file$/);
  if(publicFile&&request.method==="GET")return publicDocumentFile(env,headers,publicFile[1]);
  if(url.pathname==="/api/settings"&&request.method==="GET")return publicSettings(env,headers);
  if(url.pathname==="/api/sectors"&&request.method==="GET")return listSectors(env,headers);

  if(url.pathname.startsWith("/api/admin/")){
    const write=request.method!=="GET",user=await requireSession(request,env,write);
    if(!user)return error("No autorizado o CSRF inválido",401,headers);
    if(url.pathname==="/api/admin/dashboard"&&request.method==="GET"){
      const pending=await env.DB.prepare("SELECT count(*) count FROM uploads WHERE status!='PUBLICABLE'").first();
      return json({pending:Number(pending?.count||0),username:user.username,role:user.role},200,headers)
    }
    if(url.pathname==="/api/admin/users"&&request.method==="GET")return isAdmin(user)?listUsers(env,headers):error("Solo administración puede gestionar usuarios",403,headers);
    if(url.pathname==="/api/admin/users"&&request.method==="POST")return isAdmin(user)?createUser(request,env,headers,user):error("Solo administración puede gestionar usuarios",403,headers);
    if(url.pathname==="/api/admin/settings"&&request.method==="GET")return isAdmin(user)?adminGetSettings(env,headers):error("Solo administración puede ver los ajustes",403,headers);
    if(url.pathname==="/api/admin/settings"&&request.method==="PUT")return isAdmin(user)?adminUpdateSettings(request,env,headers,user):error("Solo administración puede editar los ajustes",403,headers);
    if(url.pathname==="/api/admin/uploads"&&request.method==="POST")return canUpload(user)?receiveUpload(request,env,headers,user):error("Este usuario no tiene permiso para subir documentos",403,headers);
    if(url.pathname==="/api/admin/history"&&request.method==="GET")return listHistory(env,headers,user);
    const publish=url.pathname.match(/^\/api\/admin\/uploads\/([^/]+)\/publish$/);
    if(publish&&request.method==="POST")return publishVersion(request,env,headers,user,publish[1]);
    if(url.pathname==="/api/admin/candidates"&&request.method==="GET")return listCandidates(env,headers);
    const candidate=url.pathname.match(/^\/api\/admin\/candidates\/([^/]+)\/(file|confirm|reanonymize)$/);
    if(candidate&&request.method==="GET"&&candidate[2]==="file")return candidateFile(env,headers,candidate[1]);
    if(candidate&&request.method==="POST"&&candidate[2]==="confirm")return confirmCandidate(request,env,headers,user,candidate[1]);
    if(candidate&&request.method==="POST"&&candidate[2]==="reanonymize")return requestReanonymization(env,headers,user,candidate[1]);
  }
    return error("No encontrado",404,headers)
}

export default{
    async fetch(request,env){try{return await route(request,env)}catch(caught){console.error(caught);return error("Error interno",500,cors(env,request))}},
    async scheduled(event,env,ctx){ctx.waitUntil(Promise.all([env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(Date.now()).run(),env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(Math.floor(Date.now()/1000)).run(),audit(env,"system","SCHEDULED_MAINTENANCE","system",String(event.scheduledTime))]))}
};
