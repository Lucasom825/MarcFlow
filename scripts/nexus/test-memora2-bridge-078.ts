import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {
  bridgeConfig078,signNexusMemora078,readMemora2Bridge078,Bridge078Error
} from "../../src/lib/nexus-memora2-bridge-078";

const secret="B".repeat(44);
const env={
  NEXUS_MEMORA2_BRIDGE_ENABLED:"true",
  NEXUS_MEMORA2_BRIDGE_SECRET:secret,
  NEXUS_MEMORA2_OWNER_EMAIL:"verified@example.org",
  NEXUS_MEMORA2_ORIGIN:"https://memora2.example.org",
  NEXUS_MEMORA2_ALLOWED_HOST:"memora2.example.org",
};
const source={
  schema:"MEMORA2_NEXUS_READINESS_V1",
  source:"MEMORA2_SCOPED_READONLY",
  generated_at:"2026-11-12T00:00:00.000Z",
  items:[{
    id:"m2_"+"a".repeat(30),source:"recorded",status:"PROCESSED",
    createdAt:"2026-11-12T00:00:00.000Z",pdfVersion:2,hasSavedPdf:true
  }]
};
const response=(body:any,status=200,type="application/json")=>new Response(
  JSON.stringify(body),{status,headers:{"Content-Type":type}}
);
test("bridge disabled without all independent operator-side gates",()=>{
  assert.equal(bridgeConfig078({}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_BRIDGE_ENABLED:"false"}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_BRIDGE_SECRET:"weak"}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_OWNER_EMAIL:""}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_ALLOWED_HOST:"other.example.org"}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_ORIGIN:"http://memora2.example.org"}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_ORIGIN:"https://memora2.example.org/path"}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_ORIGIN:"https://name:pass@memora2.example.org"}),null);
  assert.equal(bridgeConfig078({...env,NEXUS_MEMORA2_ORIGIN:"https://memora2.example.org:8443"}),null);
  assert.ok(bridgeConfig078(env));
});

test("client HMAC matches the independent standard SHA-256 implementation",async()=>{
  const ts="1763010000";
  const nonce="abcdef00112233445566778899aabbcc";
  const payload=["memora-nexus-readiness-v1","GET",
    "/api/integrations/nexus/readiness",ts,nonce,"nexus-memora2-v1"].join("\n");
  const expected=createHmac("sha256",secret).update(payload).digest("hex");
  assert.equal(await signNexusMemora078(secret,ts,nonce),expected);
});

test("only fixed HTTPS signed GET, no cookies, no redirects, no storage, bounded JSON",async()=>{
  const config=bridgeConfig078(env);assert.ok(config);
  let calls=0;
  const fake=async (input:RequestInfo|URL,init?:RequestInit)=>{
    calls++;
    assert.equal(input,"https://memora2.example.org/api/integrations/nexus/readiness");
    assert.equal(init?.method,"GET");
    assert.equal(init?.redirect,"error");
    assert.equal(init?.cache,"no-store");
    assert.equal(init?.credentials,"omit");
    const h=new Headers(init?.headers);
    assert.equal(h.has("cookie"),false);
    assert.equal(h.has("authorization"),false);
    assert.equal(h.get("x-memora-nexus-client"),"nexus-memora2-v1");
    assert.match(h.get("x-memora-nexus-signature")??"",/^[0-9a-f]{64}$/);
    return response(source);
  };
  const out=await readMemora2Bridge078(config,fake as typeof fetch,1763010000000);
  assert.equal(calls,1);
  assert.equal(out.source_scope,"ADAPTED_METADATA_ONLY");
  assert.equal(out.writes_performed,0);
  assert.equal(out.items.length,1);
  assert.equal(out.items[0].readiness,"PDF_PRESENT_NOT_VALIDATED");
  assert.equal(out.items[0].minutes_quality_verified,false);
});

test("fail-closed for unauthorized, wrong schema, leaking IDs or excess response",async()=>{
  const config=bridgeConfig078(env);assert.ok(config);
  const cases=[
    response({error:"no"},401),
    response({...source,schema:"BAD"}),
    response({...source,items:[{...source.items[0],id:"REAL-MEETING-ID"}]}),
    response({...source,items:[{...source.items[0],hasSavedPdf:"yes"}]}),
    response({...source,items:Array.from({length:9},()=>source.items[0])}),
    response(source,200,"text/html"),
    response({padding:"x".repeat(17000)}),
  ];
  for(const reply of cases){
    await assert.rejects(
      ()=>readMemora2Bridge078(config,async()=>reply,1763010000000),
      (e:unknown)=>e instanceof Bridge078Error
    );
  }
});

test("API access never allowed to a demo or unrelated user",()=>{
  const route=readFileSync("src/app/api/nexus/memora2/readiness/route.ts","utf8");
  const page=readFileSync("src/app/dashboard/nexus/rea/memora2-live/page.tsx","utf8");
  assert.match(route,/NEXUS_DEMO_ONLY.*"true"/);
  assert.match(route,/email==="demo@nexus.invalid"/);
  assert.match(route,/email!==config.ownerEmail/);
  assert.match(route,/status:405/);
  assert.match(page,/notFound\(\)/);
  assert.match(page,/NEXUS_DEMO_ONLY.*"true"/);
});
test("live page is click-only; no tokens in browser or privileged writes",()=>{
  const page=readFileSync("src/components/nexus/memora2-live-078.tsx","utf8");
  assert.match(page,/onClick=\{\(\)=>void load\(\)\}/);
  assert.match(page,/method:"GET"/);
  for(const forbidden of [/localStorage|sessionStorage|indexedDB|WebSocket/,
    /dangerouslySetInnerHTML|new Function\(|eval\(/,
    /NEXUS_MEMORA2_BRIDGE_SECRET|MEMORA_NEXUS_BRIDGE_SECRET/,
    /POST|PUT|PATCH|DELETE|Authorization:/]){
    assert.doesNotMatch(page,forbidden);
  }
});
