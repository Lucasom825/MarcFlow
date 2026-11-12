import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 makeReaCsrfProof,verifyReaCsrfProof,checkReaCsrfPolicy
} from "../../src/lib/nexus-rea-csrf-071";

const origin="https://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev";
const secret="synthetic-test-only-secret-with-minimum-entropy-string-0123456789";
const userId="demo-user-123";
const now=1_000_000_000_000;

function args(overrides:Record<string,unknown>={}){
  return {
    originStatus:"ORIGIN_MISMATCH",fetchSite:"same-origin",
    fetchMode:"cors",fetchDest:"empty",
    proof:makeReaCsrfProof(userId,origin,secret,now),
    userId,trustedOrigin:origin,secret,now,
    ...overrides
  } as Parameters<typeof checkReaCsrfPolicy>[0];
}
test("signed HMAC proof is bound to authenticated user, origin and window",()=>{
  const token=makeReaCsrfProof(userId,origin,secret,now);
  assert.match(token??"",/^v1\.[0-9]+\.[a-f0-9]{64}$/);
  assert.equal(verifyReaCsrfProof(token,userId,origin,secret,now),true);
  assert.equal(verifyReaCsrfProof(token,"another-user",origin,secret,now),false);
  assert.equal(verifyReaCsrfProof(token,userId,"https://other-39164.app.github.dev",secret,now),false);
  assert.equal(verifyReaCsrfProof(token,userId,origin,"different-"+secret,now),false);
  assert.equal(verifyReaCsrfProof(token,userId,origin,secret,now+20*60*1000),false);
  assert.equal(verifyReaCsrfProof(token,userId,origin,secret,now+9*60*1000),true);
});
test("deny empty, expired, malformed and forged tokens",()=>{
  const token=makeReaCsrfProof(userId,origin,secret,now);
  for(const bad of [null,"","deadbeef",token+"x", "v1.0."+"f".repeat(64),
    "v1.999999999999."+"f".repeat(64), "v1.1."+"F".repeat(64),
    "v1.1."+"a".repeat(500)]){
    assert.equal(verifyReaCsrfProof(bad,userId,origin,secret,now),false,bad?.slice(0,20));
  }
  assert.equal(makeReaCsrfProof(userId,origin,undefined,now),null);
  assert.equal(makeReaCsrfProof(userId,"http://other.site",secret,now),null);
  assert.equal(makeReaCsrfProof("",origin,secret,now),null);
});
test("proxy Origin mismatch permitted only with valid proof and browser Fetch Metadata",()=>{
  assert.equal(checkReaCsrfPolicy(args()),"CSRF_OK");
  assert.equal(checkReaCsrfPolicy(args({originStatus:"ORIGIN_OK"})),"CSRF_OK");
  for(const site of ["cross-site","same-site","none",null,"unexpected"]){
    assert.equal(checkReaCsrfPolicy(args({fetchSite:site})),"FETCH_SITE_UNTRUSTED",String(site));
  }
  for(const mods of [
    {fetchMode:"navigate"},{fetchMode:"no-cors"},{fetchMode:null},
    {fetchDest:"document"},{fetchDest:null}
  ])assert.equal(checkReaCsrfPolicy(args(mods)),"FETCH_MODE_UNTRUSTED");
  assert.equal(checkReaCsrfPolicy(args({proof:null})),"CSRF_PROOF_MISSING");
  assert.equal(checkReaCsrfPolicy(args({proof:"forged"})),"CSRF_PROOF_INVALID");
  assert.equal(checkReaCsrfPolicy(args({userId:"attacker"})),"CSRF_PROOF_INVALID");
  for(const status of ["AUTH_URL_MISSING","BROWSER_ORIGIN_INVALID","ORIGIN_HEADER_MISSING","FAKE"]){
    assert.equal(checkReaCsrfPolicy(args({originStatus:status})),"CSRF_PROOF_INVALID");
  }
});
test("api route requires Auth.js, signed proof, Fetch Metadata and preserves strict rate limit",()=>{
  const request=readFileSync("src/app/api/nexus/rea/request/route.ts","utf8");
  const config=readFileSync("src/app/api/nexus/rea/config/route.ts","utf8");
  const client=readFileSync("src/components/nexus/rea-070-request.tsx","utf8");
  assert.match(request,/await auth\(\)/);
  assert.match(request,/session\.user\.id/);
  assert.match(request,/checkReaCsrfPolicy/);
  assert.match(request,/x-nexus-rea-proof/);
  assert.match(request,/sec-fetch-site/);
  assert.match(request,/sec-fetch-mode/);
  assert.match(request,/sec-fetch-dest/);
  assert.match(request,/if\(proofStatus!=="CSRF_OK"\)/);
  assert.match(request,/validateRea070Request/);
  assert.match(request,/120000/);
  assert.match(config,/makeReaCsrfProof/);
  assert.match(config,/await auth\(\)/);
  assert.match(config,/Cache-Control":"private, no-store/);
  assert.doesNotMatch(config,/Access-Control-Allow-Origin/i);
  assert.match(client,/X-NEXUS-REA-Proof/);
  assert.match(client,/fetch\("\/api\/nexus\/rea\/config"/);
});
