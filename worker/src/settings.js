import{error,json}from"./http.js";
const PUBLIC_KEYS=["app_name","default_page_size","theme"];
const ALL_KEYS=["app_name","default_page_size","max_upload_bytes","theme"];
export async function getAllSettings(env){const{results}=await env.DB.prepare("SELECT key,value FROM app_settings").all();return Object.fromEntries((results||[]).map(row=>[row.key,row.value]))}
export async function getSetting(env,key,fallback){const row=await env.DB.prepare("SELECT value FROM app_settings WHERE key=?").bind(key).first();return row?.value??fallback}
export async function publicSettings(env,headers){const all=await getAllSettings(env),out={};for(const key of PUBLIC_KEYS)if(all[key]!==undefined)out[key]=all[key];return json(out,200,headers)}
export async function adminGetSettings(env,headers){return json(await getAllSettings(env),200,headers)}
export async function adminUpdateSettings(request,env,headers,user){
  let body;try{body=await request.json()}catch{return error("Petición inválida",400,headers)}
  const writes=[];
  for(const key of ALL_KEYS){
    if(body[key]===undefined||body[key]===null)continue;
    const value=String(body[key]).trim().slice(0,500);
    if(!value)continue;
    writes.push(env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(key,value,Date.now()).run());
  }
  if(!writes.length)return error("Nada que actualizar",400,headers);
  await Promise.all(writes);
  await env.DB.prepare("INSERT INTO audit_log(actor,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)").bind(user.username,"UPDATE_SETTINGS","settings","app",JSON.stringify(body)).run();
  return adminGetSettings(env,headers)
}
