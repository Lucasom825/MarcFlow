import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {
 payloadNexus084,signNexusMemora084,readMemora2Bridge084
} from "../../src/lib/nexus-memora2-bridge-084";
import {bridgeConfig078,Bridge078Error} from "../../src/lib/nexus-memora2-bridge-078";

const secret="K".repeat(48);
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const grant="grant_synthetic_084_contract";
const binding={memoraOwnerId:owner,grantId:grant};
const time=1763030000000;
const env={
 NEXUS_MEMORA2_BRIDGE_ENABLED:"true",
 NEXUS_MEMORA2_BRIDGE_SECRET:secret,
 NEXUS_MEMORA2_OWNER_EMAIL:"synthetic@example.test",
 NEXUS_MEMORA2_ORIGIN:"https://memora-synthetic.example.test",
 NEXUS_MEMORA2_ALLOWED_HOST:"memora-synthetic.example.test"
};
const report={
 schema:"MEMORA2_NEXUS_READINESS_V1",
 source:"MEMORA2_SCOPED_READONLY",
 generated_at:"2026-11-13T08:00:00.000Z",
 items:[{
  id:"m2_"+"a".repeat(30),source:"recorded",status:"PROCESSED",
  createdAt:"2026-11-13T08:00:00.000Z",pdfVersion:1,hasSavedPdf:true
 }]
};
const response=(body:unknown,status=200)=>
 new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});

test("v2 HMAC signs exact version/method/path/time/nonce/client/owner/grant",async()=>{
 const ts="1763030000",nonce="a".repeat(32);
 const p=payloadNexus084(ts,nonce,binding);
 assert.equal(p,[
  "memora-nexus-readiness-v2","GET","/api/integrations/nexus/readiness",
  ts,nonce,"nexus-memora2-v1",owner,grant
 ].join("\n"));
 const signature=createHmac("sha256",secret).update(p).digest("hex");
 assert.equal(await signNexusMemora084(secret,ts,nonce,binding),signature);
 assert.notEqual(await signNexusMemora084(secret,ts,nonce,{...binding,grantId:"grant_changed_084_contract"}),signature);
 assert.notEqual(await signNexusMemora084(secret,ts,nonce,{...binding,memoraOwnerId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}),signature);
});
test("invalid owner/grant cannot be signed or sent over the network",async()=>{
 const config=bridgeConfig078(env);assert.ok(config);
 for(const invalid of [
  {memoraOwnerId:"bad",grantId:grant},
  {memoraOwnerId:owner,grantId:"not_a_grant"},
  {memoraOwnerId:owner.toUpperCase(),grantId:grant}
 ]){
  let calls=0;
  await assert.rejects(
   ()=>readMemora2Bridge084(config,invalid as typeof binding,async()=>{calls++;return response(report);}),
   (e:unknown)=>e instanceof Bridge078Error&&e.code==="INVALID_BINDING"
  );
  assert.equal(calls,0);
 }
});
test("v2 only signed GET has bound headers and never sends cookies or Authorization",async()=>{
 const config=bridgeConfig078(env);assert.ok(config);
 let calls=0;
 const fetcher=async (url:RequestInfo|URL,options?:RequestInit)=>{
  calls++;
  assert.equal(String(url),"https://memora-synthetic.example.test/api/integrations/nexus/readiness");
  assert.equal(options?.method,"GET");
  assert.equal(options?.redirect,"error");
  assert.equal(options?.credentials,"omit");
  assert.equal(options?.cache,"no-store");
  const h=new Headers(options?.headers);
  assert.equal(h.get("x-memora-nexus-protocol"),"2");
  assert.equal(h.get("x-memora-nexus-owner"),owner);
  assert.equal(h.get("x-memora-nexus-grant"),grant);
  assert.equal(h.get("x-memora-nexus-client"),"nexus-memora2-v1");
  assert.match(h.get("x-memora-nexus-nonce")??"",/^[a-f0-9]{32}$/);
  assert.match(h.get("x-memora-nexus-signature")??"",/^[a-f0-9]{64}$/);
  assert.equal(h.has("cookie"),false);
  assert.equal(h.has("authorization"),false);
  assert.equal(h.get("x-memora-nexus-timestamp"),String(Math.floor(time/1000)));
  const expected=createHmac("sha256",secret).update(payloadNexus084(
   h.get("x-memora-nexus-timestamp")!,
   h.get("x-memora-nexus-nonce")!,binding)).digest("hex");
  assert.equal(h.get("x-memora-nexus-signature"),expected);
  return response(report);
 };
 const result=await readMemora2Bridge084(config,binding,fetcher as typeof fetch,time);
 assert.equal(calls,1);
 assert.equal(result.writes_performed,0);
 assert.equal(result.items[0].readiness,"PDF_PRESENT_NOT_VALIDATED");
});
test("bad responses fail closed and cannot leak meeting IDs",async()=>{
 const config=bridgeConfig078(env);assert.ok(config);
 const invalid=[
  response({error:"no"},401),
  response({...report,schema:"BAD"}),
  response({...report,items:[{...report.items[0],id:"real-meeting-123"}]}),
  response({...report,items:[{...report.items[0],hasSavedPdf:"yes"}]}),
  response({...report,items:Array.from({length:9},()=>report.items[0])}),
  new Response("<html>x</html>",{status:200,headers:{"Content-Type":"text/html"}}),
  response({padding:"z".repeat(17_000)})
 ];
 for(const item of invalid){
  await assert.rejects(
   ()=>readMemora2Bridge084(config,binding,async()=>item,time),
   (e:unknown)=>e instanceof Bridge078Error
  );
 }
});
test("operational API only invokes protocol v2; no v1 fallback",()=>{
 const s=readFileSync("src/app/api/nexus/memora2/readiness/route.ts","utf8");
 assert.match(s,/readMemora2Bridge084\(config/);
 assert.match(s,/readNexusOwnerGrant083\(process.env\)/);
 assert.doesNotMatch(s,/readMemora2Bridge078\(/);
 assert.match(s,/evaluateNexusIdentity083/);
});
