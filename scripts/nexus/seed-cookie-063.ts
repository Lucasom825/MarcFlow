// NEXUS 063 — disposable MySQL fixtures for REAL interactive authentication.
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";

const FLOW = "nexus063_owner_flow";
const DB = "nexus063";
const original = JSON.parse(readFileSync(new URL("./exemplo-marcflow-preview.json", import.meta.url), "utf8")).graph;
function guard(){
  assert.equal(process.env.NEXUS063_EPHEMERAL_ONLY,"true");
  const u=new URL(process.env.DATABASE_URL||"mysql://invalid/");
  assert.equal(u.protocol,"mysql:");assert.equal(u.hostname,"127.0.0.1");assert.equal(u.pathname,"/"+DB);
}
async function main(){
  guard();
  try{
    assert.equal(await prisma.user.count(),0,"Refusing to seed an existing database.");
    assert.equal(await prisma.flow.count(),0,"Refusing to seed an existing flow dataset.");
    const password=bcrypt.hashSync("nexus063-owner-disposable-password",10);
    const otherPassword=bcrypt.hashSync("nexus063-other-disposable-password",10);
    const owner=await prisma.user.create({data:{
      name:"NEXUS063 TEST OWNER",email:"owner063@example.invalid",
      password,role:"OWNER",apiKey:null,
    }});
    const other=await prisma.user.create({data:{
      name:"NEXUS063 TEST OTHER",email:"other063@example.invalid",
      password:otherPassword,role:"OWNER",apiKey:null,
    }});
    const session=await prisma.session.create({data:{
      name:"Offline synthetic OWNER session",userId:owner.id,
      sessionId:"nexus063_owner_session",status:"DISCONNECTED",
    }});
    const otherSession=await prisma.session.create({data:{
      name:"Offline synthetic OTHER session",userId:other.id,
      sessionId:"nexus063_other_session",status:"DISCONNECTED",
    }});
    await prisma.flow.create({data:{
      id:FLOW,name:"NEXUS063 Rascunho fictício - não publicar",
      sessionId:session.id,draftGraph:original,
      draftRevision:0,status:"DRAFT",
    }});
    await prisma.flow.create({data:{
      id:"nexus063_other_flow",name:"Other user's isolated flow",
      sessionId:otherSession.id,draftGraph:original,
      draftRevision:0,status:"DRAFT",
    }});
    assert.equal(await prisma.flow.count(),2);
    console.log("NEXUS063_SEED_MYSQL_TWO_ISOLATED_USERS_PASS=true");
  }finally{await prisma.$disconnect();}
}
main().catch(e=>{console.error("NEXUS063_SEED_FAILED",e.message);process.exitCode=1});
