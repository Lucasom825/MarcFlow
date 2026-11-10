/**
 * CI-only proof that an edited synthetic draft survives a full Docker Compose down/up.
 * Never use against production or a nonlocal database.
 */
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";

const FLOW = "nexus_demo_first_flow";
async function main() {
  assert.equal(process.env.NEXUS_DEMO_ONLY,"true");
  assert.equal(process.env.NEXUS_DEMO_EMAIL,"demo@nexus.invalid");
  const url=new URL(process.env.DATABASE_URL||"mysql://invalid/");
  assert.equal(url.hostname,"db");
  assert.equal(url.pathname,"/nexus_demo");
  const step=process.argv[2];
  assert.ok(["before","mutate","after"].includes(step));
  try {
    assert.equal(await prisma.user.count(),1);
    assert.equal(await prisma.session.count(),1);
    const owner=await prisma.user.findFirstOrThrow();
    assert.equal(owner.email,"demo@nexus.invalid");
    assert.equal(owner.apiKey,null);
    const session=await prisma.session.findFirstOrThrow();
    assert.equal(session.status,"DISCONNECTED");
    assert.equal(session.sessionId,"nexus_demo_session");
    assert.equal(session.userId,owner.id);
    const config=await prisma.systemConfig.findUniqueOrThrow({where:{id:"default"}});
    assert.equal(config.enableRegistration,false);
    const flow=await prisma.flow.findUniqueOrThrow({where:{id:FLOW}});
    assert.equal(flow.status,"DRAFT");
    assert.equal(flow.publishedGraph,null);
    const graph=flow.draftGraph;
    assert.equal(graph.nodes.length,2);
    assert.equal(graph.edges.length,1);
    if(step==="before")assert.equal(flow.draftRevision,0);
    if(step==="mutate"){
      assert.equal(flow.draftRevision,0);
      const changed=structuredClone(graph);
      changed.nodes[0].position.x+=9;
      const result=await prisma.flow.updateMany({
        where:{id:FLOW,draftRevision:0,status:"DRAFT"},
        data:{draftGraph:changed,draftRevision:{increment:1}},
      });
      assert.equal(result.count,1);
    }
    if(step==="after"){
      assert.equal(flow.draftRevision,1);
      assert.ok(Number.isFinite(graph.nodes[0].position.x));
      assert.equal(await prisma.flow.count(),1);
      // The mutated data is the only draft and is not reset by idempotent seed.
      assert.equal((await prisma.flow.findUniqueOrThrow({where:{id:FLOW}})).draftRevision,1);
    }
    console.log("NEXUS064_PERSISTENCE_"+step.toUpperCase()+"_PASS=true");
  } finally {await prisma.$disconnect()}
}
main().catch(e=>{console.error("NEXUS064_PERSISTENCE_FAILED",e.message);process.exitCode=1;});
