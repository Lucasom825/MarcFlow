// NEXUS 063—verify real cookie-driven browser edits persisted in temporary MySQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
const original=JSON.parse(readFileSync(new URL("./exemplo-marcflow-preview.json",import.meta.url),"utf8")).graph;
const FLOW="nexus063_owner_flow";
function guard(){
 assert.equal(process.env.NEXUS063_EPHEMERAL_ONLY,"true");
 const u=new URL(process.env.DATABASE_URL||"mysql://invalid/");
 assert.equal(u.hostname,"127.0.0.1");assert.equal(u.pathname,"/nexus063");
}
async function main(){
 guard();try{
  const mode=process.argv[2];assert.ok(["before","after"].includes(mode));
  const owner=await prisma.flow.findUniqueOrThrow({where:{id:FLOW}});
  const other=await prisma.flow.findUniqueOrThrow({where:{id:"nexus063_other_flow"}});
  if(mode==="before"){
   assert.equal(owner.draftRevision,0);
   assert.deepEqual(owner.draftGraph,original);
  }else{
   assert.equal(owner.draftRevision,1,"Original editor must save once through its real API");
   const g=owner.draftGraph;
   assert.equal(g.nodes.length,3);
   assert.equal(g.edges.length,1);
   assert.equal(g.edges[0].source,"df_1");
   assert.equal(g.edges[0].target,"df_2");
  }
  assert.equal(owner.status,"DRAFT");
  assert.equal(owner.publishedGraph,null);
  assert.equal(other.draftRevision,0);
  assert.deepEqual(other.draftGraph,original);
  assert.equal(other.status,"DRAFT");
  assert.equal(other.publishedGraph,null);
  const sessions=await prisma.session.findMany();
  assert.equal(sessions.length,2);
  assert.ok(sessions.every(s=>s.status==="DISCONNECTED"));
  console.log("NEXUS063_MYSQL_"+mode.toUpperCase()+"_PASS=true");
  console.log("NEXUS063_NO_WHATSAPP_OR_PUBLICATION=true");
 }finally{await prisma.$disconnect();}
}
main().catch(e=>{console.error("NEXUS063_DB_CHECK_FAILED",e.stack||String(e));process.exitCode=1});
