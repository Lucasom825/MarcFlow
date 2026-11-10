// NEXUS 062: HTTP tests against original Next proxy/handlers and ephemeral MySQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
const URL_BASE = "http://127.0.0.1:39162/api/flows/";
const SESSION = "nexus062_test_session", FLOW = "nexus062_test_flow";
const OWNER = "nexus062_owner_key_disposable_not_secret";
const OTHER = "nexus062_other_key_disposable_not_secret";
const URL_FLOW = URL_BASE + SESSION + "/" + FLOW;
const GRAPH = JSON.parse(readFileSync(new URL("./exemplo-marcflow-preview.json", import.meta.url), "utf8")).graph;
function guard(){
  assert.equal(process.env.NEXUS062_EPHEMERAL_ONLY, "true");
  const u = new URL(process.env.DATABASE_URL || "mysql://invalid/");
  assert.equal(u.hostname,"127.0.0.1"); assert.equal(u.pathname,"/nexus062");
}
async function http(url, key, payload) {
  const headers = new Headers();
  if(key) headers.set("x-api-key",key);
  if(payload !== undefined) headers.set("Content-Type","application/json");
  const response = await fetch(url, {
    method:payload === undefined?"GET":"PUT",headers,
    body:payload === undefined?undefined:JSON.stringify(payload),
    redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(20000),
  });
  let data={};
  try{data=await response.json()}catch{}
  return {code:response.status,json:data};
}
let passes=0;
function check(label, fn){fn(); passes++; console.log("NEXUS062_HTTP_PASS "+label);}
async function before(){
  const owner=await http(URL_FLOW,OWNER);
  check("owner GET authenticated and initial revision",()=>{
    assert.equal(owner.code,200);assert.equal(owner.json.data.draftRevision,0);
    assert.equal(owner.json.data.draftGraph.nodes.length,2);assert.equal(owner.json.data.draftGraph.edges.length,1);
  });
  const noKey=await http(URL_FLOW);
  check("unauthenticated GET denied",()=>assert.equal(noKey.code,401));
  const fake=await http(URL_FLOW,"wrong_062");
  check("invalid key GET denied",()=>assert.equal(fake.code,401));
  const cross=await http(URL_FLOW,OTHER);
  check("other user GET denied",()=>assert.equal(cross.code,403));
  const crossPut=await http(URL_FLOW+"/draft",OTHER,{graph:GRAPH,revision:0});
  check("other user PUT denied",()=>assert.equal(crossPut.code,403));
  const noPut=await http(URL_FLOW+"/draft",undefined,{graph:GRAPH,revision:0});
  check("unauthenticated PUT denied",()=>assert.equal(noPut.code,401));
  const bad=await http(URL_FLOW+"/draft",OWNER,{graph:GRAPH,revision:"broken"});
  check("invalid revision rejected through HTTP",()=>assert.equal(bad.code,400));
  const state=await prisma.flow.findUniqueOrThrow({where:{id:FLOW}});
  check("blocked requests did not affect MySQL",()=>{
    assert.equal(state.draftRevision,0);assert.equal(state.publishedGraph,null);assert.equal(state.status,"DRAFT");
  });
}
async function after(){
  const edited=await http(URL_FLOW,OWNER),re=edited.json.data?.draftRevision;
  check("real React Flow autosave committed through HTTP",()=>{
    assert.equal(edited.code,200);assert.ok(Number.isInteger(re)&&re>=1);
    assert.equal(edited.json.data.draftGraph.nodes.length,3);
    assert.equal(edited.json.data.draftGraph.edges.length,1);
    assert.equal(edited.json.data.draftGraph.edges[0].source,"df_1");
    assert.equal(edited.json.data.draftGraph.edges[0].target,"df_2");
    assert.equal(edited.json.data.status,"DRAFT");assert.equal(edited.json.data.publishedGraph,null);
  });
  const db=await prisma.flow.findUniqueOrThrow({where:{id:FLOW}});
  check("direct Prisma read matches real HTTP",()=>{
    assert.equal(db.draftRevision,re);assert.deepEqual(db.draftGraph,edited.json.data.draftGraph);
  });
  const stale=await http(URL_FLOW+"/draft",OWNER,{graph:GRAPH,revision:0});
  check("stale HTTP draft denied with current revision",()=>{
    assert.equal(stale.code,409);assert.equal(stale.json.data?.revision,re);
  });
  const restore=await http(URL_FLOW+"/draft",OWNER,{graph:GRAPH,revision:re});
  check("restoration is a new version not a publication",()=>{
    assert.equal(restore.code,200);assert.equal(restore.json.data?.revision,re+1);
  });
  const final=await http(URL_FLOW,OWNER);
  check("restored graph roundtrips over HTTP/MySQL",()=>{
    assert.equal(final.code,200);assert.equal(final.json.data.draftRevision,re+1);
    assert.deepEqual(final.json.data.draftGraph,GRAPH);
    assert.equal(final.json.data.publishedGraph,null);assert.equal(final.json.data.status,"DRAFT");
  });
  const unrelated=await http(URL_BASE+"nexus062_other_session/nexus062_other_flow",OTHER);
  check("other user's flow remains unchanged",()=>{
    assert.equal(unrelated.code,200);assert.equal(unrelated.json.data.draftRevision,0);
    assert.deepEqual(unrelated.json.data.draftGraph,GRAPH);
  });
}
async function main(){
  guard();try{
    const phase=process.argv[2];assert.ok(["before","after"].includes(phase));
    if(phase==="before")await before();else await after();
    console.log("NEXUS062_HTTP_"+phase.toUpperCase()+"_PASS="+passes);
    console.log("NEXUS062_REAL_HTTP_AND_MYSQL=true");
    console.log("NEXUS062_PRODUCTION_DATABASE_USED=false");
  }finally{await prisma.$disconnect();}
}
main().catch(e=>{console.error("NEXUS062_HTTP_FAIL",e.stack||String(e));process.exitCode=1;});
