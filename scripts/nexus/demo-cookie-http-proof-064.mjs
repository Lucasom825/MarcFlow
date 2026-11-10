/**
 * NEXUS 064 — real Auth.js Credentials cookie, permitted draft save and forbidden publish.
 * CI-only, inside the app container on loopback, with synthetic private demo credentials.
 * Never prints passwords, session tokens, authorization headers or database URLs.
 */
import assert from "node:assert/strict";

const BASE = "http://127.0.0.1:39164";
const SESSION = "nexus_demo_session";
const FLOW = "nexus_demo_first_flow";
const COOKIE = new Map();
function guard() {
  assert.equal(process.env.NEXUS_DEMO_ONLY, "true");
  assert.equal(process.env.NEXUS_DEMO_EMAIL, "demo@nexus.invalid");
  const db = new URL(process.env.DATABASE_URL || "mysql://invalid/");
  assert.equal(db.hostname, "db"); assert.equal(db.pathname, "/nexus_demo");
  assert.ok((process.env.NEXUS_DEMO_PASSWORD || "").length >= 24);
}
function absorb(response) {
  for (const line of response.headers.getSetCookie?.() || []) {
    const pair = line.split(";", 1)[0];
    const sep = pair.indexOf("=");
    if (sep <= 0) continue;
    const key = pair.slice(0,sep), value = pair.slice(sep + 1);
    if (value === "") COOKIE.delete(key); else COOKIE.set(key, value);
  }
}
async function http(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (COOKIE.size) headers.set("Cookie", [...COOKIE].map(([k,v]) => k+"="+v).join("; "));
  const r = await fetch(BASE+path,{
    ...opts, headers, redirect:"manual", signal:AbortSignal.timeout(20000),
  });
  absorb(r);
  return r;
}
async function json(path,opts) {
  const r=await http(path,opts);
  let body={};
  try {body=await r.json()} catch {}
  return {code:r.status,body};
}
async function main(){
  guard();
  const csrf=await json("/api/auth/csrf");
  assert.equal(csrf.code,200);
  assert.ok(typeof csrf.body.csrfToken === "string" && csrf.body.csrfToken.length > 10);
  const form = new URLSearchParams({
    csrfToken: csrf.body.csrfToken,
    email: process.env.NEXUS_DEMO_EMAIL,
    password: process.env.NEXUS_DEMO_PASSWORD,
    callbackUrl: BASE+"/dashboard/flows/"+FLOW,
    json: "true",
  });
  const login=await http("/api/auth/callback/credentials",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:form,
  });
  assert.ok([200,302,303].includes(login.status),"Real Credentials callback rejected synthetic login: "+login.status);
  const sessionCookie=login.headers.getSetCookie?.().find(v=>/authjs\.session-token|next-auth\.session-token/i.test(v))||"";
  assert.ok(/httponly/i.test(sessionCookie),"Auth.js session must be HttpOnly");
  const sess=await json("/api/auth/session");
  assert.equal(sess.code,200);
  assert.equal(sess.body.user?.email,"demo@nexus.invalid","Real login must grant owner cookie");
  assert.ok(sess.body.user?.id);
  console.log("NEXUS064_REAL_CREDENTIALS_HTTPONLY_COOKIE_PASS=true");
  const sessions=await json("/api/sessions");
  assert.equal(sessions.code,200);
  assert.equal(sessions.body.data?.length,1);
  assert.equal(sessions.body.data[0].status,"DISCONNECTED");

  const prefix="/api/flows/"+SESSION;
  const before=await json(prefix+"/"+FLOW);
  assert.equal(before.code,200);
  assert.equal(before.body.data?.draftRevision,0);
  const graph=structuredClone(before.body.data.draftGraph);
  assert.equal(graph.nodes.length,2);
  assert.equal(graph.edges.length,1);
  graph.nodes.push({
    id:"nexus064-demo-cookie-added", type:"content",
    position:{x:630,y:250}, data:{items:[]},
  });
  const draft=await json(prefix+"/"+FLOW+"/draft",{
    method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({graph,revision:0}),
  });
  assert.equal(draft.code,200,"Cookie-authenticated draft PUT failed: "+draft.code);
  assert.equal(draft.body.data?.revision,1);
  const after=await json(prefix+"/"+FLOW);
  assert.equal(after.code,200);
  assert.equal(after.body.data?.draftRevision,1);
  assert.deepEqual(after.body.data.draftGraph,graph);
  assert.equal(after.body.data.status,"DRAFT");
  assert.equal(after.body.data.publishedGraph,null);
  console.log("NEXUS064_REAL_AUTH_COOKIE_HTTP_MYSQL_DRAFT_PASS=true");
  const stale=await json(prefix+"/"+FLOW+"/draft",{
    method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({graph,revision:0}),
  });
  assert.equal(stale.code,409,"HTTP stale write must fail with 409");
  for(const path of [
    prefix+"/"+FLOW+"/publish",prefix+"/"+FLOW+"/test",
    "/api/sessions","/api/messages/send","/api/system/check-updates",
    "/api/auth/register",
  ]){
    const r=await http(path,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    assert.equal(r.status,403,"Dangerous demo route must be blocked: "+path);
  }
  console.log("NEXUS064_REAL_AUTH_FORBIDDEN_SIDE_EFFECTS_PASS=true");
}
main().catch(err=>{
  console.error("NEXUS064_COOKIE_HTTP_FAIL",err instanceof Error?err.message:"Unexpected error");
  process.exitCode=1;
});
