import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,readFile} from "node:fs/promises";
import {readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {openSyntheticAccess086} from "./experiments/access-086-sqlite.mjs";

const T=Date.parse("2026-11-13T14:00:00.000Z");
const DAY=86_400_000;
const USER="synthetic_user_000086";
const SECOND_USER="another_user_000086";
const OWNER="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_OWNER="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GRANT="grant_synthetic_086_a";
const GRANT2="grant_synthetic_086_b";
const ACTOR="operator_synthetic_086";
const who={subject:USER,owner:OWNER,grant:GRANT,now:T};

async function sandbox(run){
 const directory=await mkdtemp(join(tmpdir(),"nexus086-synthetic-"));
 const file=join(directory,"access-086.sqlite");
 const open=()=>openSyntheticAccess086({file,approval:"APPROVED_LOCAL_SYNTHETIC"});
 let db=open();
 try{return await run(db,()=>{db.close();db=open();return db;},file);}
 finally{
   db.close();
   await rm(directory,{recursive:true,force:true});
 }
}
function start(db){
 db.registerSubject({subject:USER,actor:ACTOR,now:T});
 db.setStatus({subject:USER,status:"ACTIVE",actor:ACTOR,now:T+1});
 db.issueGrant({subject:USER,owner:OWNER,grant:GRANT,actor:ACTOR,now:T+2,expires:T+DAY});
}
test("cannot open production-like paths or without explicit synthetic approval",()=>{
 assert.throws(()=>openSyntheticAccess086({
  file:"/var/lib/mysql/application.sqlite",approval:"APPROVED_LOCAL_SYNTHETIC"}),/refuses/);
 assert.throws(()=>openSyntheticAccess086({
  file:join(tmpdir(),"real-app.sqlite"),approval:"APPROVED_LOCAL_SYNTHETIC"}),/refuses/);
 assert.throws(()=>openSyntheticAccess086({
  file:"/tmp/nexus086-synthetic-test/access-086.sqlite",approval:"no"}),/refuses/);
});
test("unknown account is denied by default, without audit writes",()=>sandbox(db=>{
 assert.deepEqual(db.authorize(who),{allowed:false,reason:"SUBJECT_UNKNOWN"});
 assert.deepEqual(db.auditSnapshot(),[]);
}));
test("new subject begins SUSPENDED and cannot receive grant until explicitly activated",()=>sandbox(db=>{
 db.registerSubject({subject:USER,actor:ACTOR,now:T});
 assert.equal(db.authorize(who).reason,"SUBJECT_SUSPENDED");
 assert.throws(()=>db.issueGrant({
  subject:USER,owner:OWNER,grant:GRANT,actor:ACTOR,now:T+1,expires:T+DAY
 }),/suspended/);
 assert.deepEqual(db.auditSnapshot().map(x=>x.action),["REGISTERED_SUSPENDED"]);
}));
test("explicit activation and grant permit exact subject/owner/grant; reads create no audit",()=>sandbox(db=>{
 start(db);
 const before=db.auditSnapshot().length;
 assert.deepEqual(db.authorize(who),{allowed:true,reason:"ALLOWED"});
 assert.deepEqual(db.authorize(who),{allowed:true,reason:"ALLOWED"});
 assert.equal(db.auditSnapshot().length,before);
}));
test("cross-owner, cross-subject and wrong grant cannot use a legitimate grant",()=>sandbox(db=>{
 start(db);
 db.registerSubject({subject:SECOND_USER,actor:ACTOR,now:T});
 db.setStatus({subject:SECOND_USER,status:"ACTIVE",actor:ACTOR,now:T+1});
 assert.equal(db.authorize({...who,owner:OTHER_OWNER}).reason,"GRANT_MISMATCH");
 assert.equal(db.authorize({...who,subject:SECOND_USER}).reason,"GRANT_MISMATCH");
 assert.equal(db.authorize({...who,grant:GRANT2}).reason,"GRANT_UNKNOWN");
 assert.equal(db.authorize({...who,grant:"../../secret"}).reason,"INVALID_INPUT");
}));
test("grant denied at exact expiry even when previously allowed",()=>sandbox(db=>{
 start(db);
 assert.equal(db.authorize({...who,now:T+DAY-1}).reason,"ALLOWED");
 assert.equal(db.authorize({...who,now:T+DAY}).reason,"GRANT_EXPIRED");
 assert.equal(db.authorize({...who,now:T+DAY+1}).reason,"GRANT_EXPIRED");
}));
test("revocation is durable across database reopen, with exactly one audit record",()=>sandbox((db,reopen)=>{
 start(db);
 assert.equal(db.revokeGrant({grant:GRANT,actor:ACTOR,now:T+4}),true);
 assert.equal(db.authorize(who).reason,"GRANT_REVOKED");
 assert.equal(db.revokeGrant({grant:GRANT,actor:ACTOR,now:T+5}),false);
 db=reopen();
 assert.equal(db.authorize(who).reason,"GRANT_REVOKED");
 const events=db.auditSnapshot();
 assert.equal(events.filter(x=>x.action==="REVOKED").length,1);
 assert.deepEqual(events.map(x=>x.action),[
  "REGISTERED_SUSPENDED","ACTIVATED","GRANTED","REVOKED"
 ]);
}));
test("SUSPEND atomically revokes grants; reactivation NEVER resurrects old grants",()=>sandbox((db,reopen)=>{
 start(db);
 assert.equal(db.setStatus({subject:USER,status:"SUSPENDED",actor:ACTOR,now:T+5}),true);
 assert.equal(db.authorize(who).reason,"SUBJECT_SUSPENDED");
 db=reopen();
 assert.equal(db.authorize(who).reason,"SUBJECT_SUSPENDED");
 db.setStatus({subject:USER,status:"ACTIVE",actor:ACTOR,now:T+6});
 assert.equal(db.authorize(who).reason,"GRANT_REVOKED");
 db.issueGrant({subject:USER,owner:OWNER,grant:GRANT2,actor:ACTOR,now:T+7,expires:T+DAY});
 assert.equal(db.authorize({...who,grant:GRANT2}).reason,"ALLOWED");
 assert.deepEqual(db.auditSnapshot().map(e=>e.action),[
   "REGISTERED_SUSPENDED","ACTIVATED","GRANTED","SUSPENDED",
   "REVOKED_ON_SUSPENSION","ACTIVATED","GRANTED"
 ]);
}));
test("only one unrevoked grant per owner and subject; failed transaction emits no audit",()=>sandbox(db=>{
 start(db);
 const count=db.auditSnapshot().length;
 assert.throws(()=>db.issueGrant({
  subject:USER,owner:OWNER,grant:GRANT2,actor:ACTOR,now:T+4,expires:T+DAY
 }),/UNIQUE constraint failed/);
 assert.equal(db.auditSnapshot().length,count);
 assert.equal(db.authorize(who).reason,"ALLOWED");
}));
test("a missing user grant and attempting to grant unknown identity fail closed",()=>sandbox(db=>{
 assert.throws(()=>db.issueGrant({
  subject:USER,owner:OWNER,grant:GRANT,actor:ACTOR,now:T,expires:T+DAY
 }),/unknown/);
 assert.deepEqual(db.auditSnapshot(),[]);
}));
test("30-day limit, invalid clock and invalid owner UUID block grant creation",()=>sandbox(db=>{
 db.registerSubject({subject:USER,actor:ACTOR,now:T});
 db.setStatus({subject:USER,status:"ACTIVE",actor:ACTOR,now:T+1});
 for(const options of [
  {expires:T+31*DAY},
  {expires:T-1},
  {owner:"not-a-uuid"},
  {owner:OWNER.toUpperCase()},
  {expires:NaN}
 ]){
  assert.throws(()=>db.issueGrant({
   subject:USER,owner:OWNER,grant:GRANT,actor:ACTOR,now:T+2,
   expires:T+DAY,...options
  }));
 }
 assert.equal(db.auditSnapshot().length,2);
}));
test("SQLite connection close fails safely; audit remains immutable across read operations",()=>sandbox(db=>{
 start(db);
 const expected=db.auditSnapshot();
 db.close();
 assert.deepEqual(db.authorize(who),{allowed:false,reason:"STORE_UNAVAILABLE"});
 assert.throws(()=>db.auditSnapshot(),/closed/);
 // Already-read event copy cannot modify the stored rows.
 assert.ok(expected.every(r=>!Object.keys(r).includes("email")));
 assert.ok(expected.every(r=>!Object.keys(r).includes("password")));
}));
test("two independent local SQLite connections immediately observe persisted revocation",()=>sandbox((db,reopen,file)=>{
 start(db);
 const secondary=openSyntheticAccess086({file,approval:"APPROVED_LOCAL_SYNTHETIC"});
 try{
  assert.equal(secondary.authorize(who).reason,"ALLOWED");
  db.revokeGrant({grant:GRANT,actor:ACTOR,now:T+8});
  assert.equal(secondary.authorize(who).reason,"GRANT_REVOKED");
 }finally{secondary.close();}
}));
test("audit records only action IDs, ordered timestamps; no meeting content or secrets",()=>sandbox(db=>{
 start(db);
 const log=db.auditSnapshot();
 assert.equal(log.length,3);
 assert.deepEqual(log.map(x=>x.sequence),[1,2,3]);
 const text=JSON.stringify(log);
 for(const marker of ["@","password","apiKey","transcript","audio","meetingTitle"])
  assert.equal(text.includes(marker),false);
 assert.deepEqual(log.map(x=>x.action),[
  "REGISTERED_SUSPENDED","ACTIVATED","GRANTED"
 ]);
}));
test("real NEXUS Prisma schema, routes and auth remain UNCHANGED by this experiment",()=>{
 const schema=readFileSync("prisma/schema.prisma","utf8");
 const route=readFileSync("src/app/api/nexus/memora2/readiness/route.ts","utf8");
 const page=readFileSync("src/app/dashboard/nexus/rea/memora2-live/page.tsx","utf8");
 const user=schema.match(/model User \{([\s\S]*?)\n\}/)?.[1]??"";
 assert.doesNotMatch(user,/^\s*(isActive|disabled|deletedAt)\s/m);
 assert.doesNotMatch(route,/openSyntheticAccess086|nx086_/);
 assert.doesNotMatch(page,/openSyntheticAccess086|nx086_/);
 assert.match(route,/await revalidateNexusUser085/);
 assert.match(route,/await readMemora2Bridge084/);
});
