import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {orderSourcesForDisplay,ruleBasedAnswer} from "../worker/src/search.js";
import {validateNewUser} from "../worker/src/users.js";

test("ordena ET, convenio, guía CGT y jurisprudencia",()=>{
  const ordered=orderSourcesForDisplay([
    {title:"Sentencia TS",document_type:"sentencia",court_level:"TS"},
    {title:"Guía Jurídico Sindical CGT",document_type:"guia_doctrina"},
    {title:"Convenio colectivo de Contact Center",document_type:"convenio"},
    {title:"Estatuto de los Trabajadores",document_type:"normativa"},
  ]);
  assert.deepEqual(ordered.map(item=>item.title),[
    "Estatuto de los Trabajadores","Convenio colectivo de Contact Center","Guía Jurídico Sindical CGT","Sentencia TS",
  ]);
});

test("valida usuarios creados para subir sentencias",()=>{
  assert.deepEqual(validateNewUser({username:"delegada_1",password:"temporal123",role:"editor"}),{username:"delegada_1",password:"temporal123",role:"editor"});
  assert.match(validateNewUser({username:"x",password:"corta"}).error,/usuario/i);
});

test("la PWA y el filtro de horas sindicales están declarados",async()=>{
  const manifest=JSON.parse(await readFile(new URL("../docs/manifest.webmanifest",import.meta.url),"utf8"));
  const html=await readFile(new URL("../docs/index.html",import.meta.url),"utf8");
  assert.equal(manifest.display,"standalone");
  assert.equal(manifest.name,"Proyecto consultas Jurídico/Sindical");
  assert.match(html,/data-keywords="[^"]*horas sindicales[^"]*"[^>]*>[\s\S]*?Derechos sindicales/);
});
test("la respuesta se deriva de las fuentes y no de una consulta programada",async()=>{
  const query="cauntos dias libres de permiso tengo por enfermedad de mi hermana";
  const withoutSources=ruleBasedAnswer(query,[]);
  assert.doesNotMatch(withoutSources,/cinco días de permiso retribuido/i);
  const docs=JSON.parse(await readFile(new URL("../docs/data/documents.json",import.meta.url),"utf8"));
  const answer=ruleBasedAnswer(query,[docs.find(item=>item.id===77),docs.find(item=>item.id===4)]);
  assert.match(answer,/cinco días/i);
  assert.match(answer,/37\.3\.b/);
  const app=await readFile(new URL("../docs/app.js",import.meta.url),"utf8");
  assert.doesNotMatch(app,/directLegalRule|familyIllness/);
  assert.match(app,/withFoundations/);
  assert.doesNotMatch(app,/current_rule_summary\|\|d\.criteria\|\|d\.summary\|\|d\.note/);
});

test("los tres BOE públicos están incorporados sin anonimización",async()=>{
  const docs=JSON.parse(await readFile(new URL("../docs/data/documents.json",import.meta.url),"utf8"));
  for(const id of [4,7,77]){
    const doc=docs.find(item=>item.id===id);
    assert.equal(doc.privacy_status,"PUBLICABLE");
    assert.match(doc.note,/no requiere anonimización/i);
    const pdf=await readFile(new URL(`../docs/${doc.source_url}`,import.meta.url));
    assert.ok(pdf.length>1000);
  }
});
test("las fuentes públicas oficiales pasan a revisión sin anonimización",async()=>{
  const config=JSON.parse(await readFile(new URL("../data/recent_sources.json",import.meta.url),"utf8"));
  assert.equal(config.feeds.find(feed=>feed.name==="CURIA").public_document,true);
  const preparation=await readFile(new URL("../tools/anonymize_candidates.py",import.meta.url),"utf8");
  const panel=await readFile(new URL("../docs/admin/admin.js",import.meta.url),"utf8");
  assert.match(preparation,/FUENTE_PUBLICA_REQUIERE_REVISION/);
  assert.match(preparation,/shutil\.copyfile\(original,anonymous\)/);
  assert.match(panel,/Ver documento público/);
});

