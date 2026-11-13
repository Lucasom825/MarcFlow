import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  revalidateNexusUser085,type ReadOnlyUserStore085
} from "../../src/lib/nexus-memora2-db-reauth-085";

const principal={id:"synthetic_user_000085",email:"trusted@example.test",role:"OWNER"};
const good={id:principal.id,email:"trusted@example.test",role:"OWNER"};
function mockDb(
  current:{id:string;email:string;role:string}|null=good,
  option:{fail?:boolean}={}
){
  let calls=0;
  const database:ReadOnlyUserStore085={
    user:{
      findUnique:async args=>{
        calls++;
        assert.deepEqual(args,{
          where:{id:principal.id},
          select:{id:true,email:true,role:true}
        });
        if(option.fail)throw new Error("SYNTHETIC_DB_ERROR_PASSWORD_CANARY");
        return current;
      }
    }
  };
  return {database,calls:()=>calls};
}
test("current account matches identity; only minimal DB fields queried",async()=>{
  const {database,calls}=mockDb();
  assert.deepEqual(await revalidateNexusUser085(database,principal),
    {allowed:true,reason:"AUTHORIZED"});
  assert.equal(calls(),1);
});
test("deleted account is denied, even with a still-valid JWT",async()=>{
  const {database,calls}=mockDb(null);
  assert.deepEqual(await revalidateNexusUser085(database,principal),
    {allowed:false,reason:"ACCOUNT_NOT_FOUND"});
  assert.equal(calls(),1);
});
test("role downgraded from OWNER to STAFF is revoked immediately on next request",async()=>{
  const {database}=mockDb({...good,role:"STAFF"});
  assert.equal((await revalidateNexusUser085(database,principal)).reason,
    "ROLE_REVOKED");
});
test("role changed from OWNER to SUPERADMIN also requires new session",async()=>{
  const {database}=mockDb({...good,role:"SUPERADMIN"});
  assert.equal((await revalidateNexusUser085(database,principal)).reason,
    "ROLE_REVOKED");
});
test("changed e-mail or mismatching DB id is denied",async()=>{
  assert.equal((await revalidateNexusUser085(
    mockDb({...good,email:"changed@example.test"}).database,principal)
  ).reason,"ACCOUNT_CHANGED");
  assert.equal((await revalidateNexusUser085(
    mockDb({...good,id:"someone_else_000085"}).database,principal)
  ).reason,"ACCOUNT_CHANGED");
});
test("session without subject, e-mail or role fails BEFORE querying DB",async()=>{
  for(const user of [
    null,{}, {...principal,id:""}, {...principal,email:""},
    {...principal,role:""}
  ]){
    const {database,calls}=mockDb();
    assert.equal((await revalidateNexusUser085(database,user)).reason,
      "MISSING_SESSION");
    assert.equal(calls(),0);
  }
});
test("DB failure is denied and internal diagnostic never leaves the decision",async()=>{
  const {database}=mockDb(good,{fail:true});
  const decision=await revalidateNexusUser085(database,principal);
  assert.deepEqual(decision,{allowed:false,reason:"DATABASE_UNAVAILABLE"});
  assert.ok(!JSON.stringify(decision).includes("PASSWORD_CANARY"));
});
test("live NEXUS API requires DB recheck before Memora GET",()=>{
  const route=readFileSync(
    "src/app/api/nexus/memora2/readiness/route.ts","utf8");
  const page=readFileSync(
    "src/app/dashboard/nexus/rea/memora2-live/page.tsx","utf8");
  const reauth=route.indexOf("await revalidateNexusUser085(");
  const remote=route.indexOf("await readMemora2Bridge084(");
  assert.ok(reauth>0 && reauth<remote);
  assert.match(route,/status:current\.reason==="DATABASE_UNAVAILABLE"\?503:403/);
  assert.match(page,/await revalidateNexusUser085\(/);
  assert.match(page,/if\(!current\.allowed\)notFound\(\)/);
  assert.match(route,/evaluateNexusIdentity083/);
  assert.match(route,/readNexusOwnerGrant083/);
  assert.doesNotMatch(route,/console\.log|console\.error|prisma\.user\.update|prisma\.user\.delete/);
});
test("Prisma User schema has NO active/disabled flag; this test does not claim soft-deactivation coverage",()=>{
  const schema=readFileSync("prisma/schema.prisma","utf8");
  const userModel=schema.match(/model User \{([\s\S]*?)\n\}/)?.[1]??"";
  assert.ok(userModel.includes("id "));
  assert.ok(userModel.includes("email "));
  assert.ok(userModel.includes("role "));
  assert.doesNotMatch(userModel,/^\s*(isActive|active|disabled|deletedAt)\s/m);
});
