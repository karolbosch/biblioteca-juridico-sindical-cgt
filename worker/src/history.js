import{json}from"./http.js";
export async function recordQuery(env,user,question,answer,mode){
  const userId=user?.id||user?.user_id;
  if(!userId)return;
  try{await env.DB.prepare("INSERT INTO query_history(user_id,question,answer_excerpt,mode) VALUES(?,?,?,?)").bind(userId,String(question||"").slice(0,500),String(answer||"").slice(0,600),String(mode||"")).run()}catch{}
}
export async function listHistory(env,headers,user){
  const userId=user?.id||user?.user_id;
  if(!userId)return json({history:[]},200,headers);
  const{results}=await env.DB.prepare("SELECT id,question,mode,created_at FROM query_history WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(userId).all();
  return json({history:results},200,headers)
}
