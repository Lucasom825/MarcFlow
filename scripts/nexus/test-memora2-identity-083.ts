import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  readNexusOwnerGrant083,evaluateNexusIdentity083,redactedIdentityDecision083
} from "../../src/lib/nexus-memora2-identity-083";

const now=Date.parse("2026-11-13T11:30:00.000Z");
const email="synthetic@example.test";
const principal={id:"synthetic_user_000083",email,role:"OWNER"};
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const config={
  NEXUS_MEMORA2_IDENTITY_APPROVED:"true",
  NEXUS_MEMORA2_IDENTITY_REVOKED:"false",
  NEXUS_MEMORA2_APPROVED_NEXUS_USER_ID:principal.id,
  NEXUS_MEMORA2_APPROVED_NEXUS_EMAIL:email,
  NEXUS_MEMORA2_APPROVED_MEMORA_OWNER_ID:owner,
  NEXUS_MEMORA2_ACCESS_GRANT_ID:"grant_synthetic_083_contract",
  NEXUS_MEMORA2_GRANT_EXPIRES_UTC:"2026-11-14T00:00:00.000Z"
};
const check=(overrides:Record<string,string|undefined>={},
  user:typeof principal|null=principal,
  bridgeEmail:string|null=email,when=now)=>
  evaluateNexusIdentity083({...config,...overrides},user,bridgeEmail,when);

test("only explicitly approved known subject and owner mapping permits read",()=>{
  const grant=readNexusOwnerGrant083(config,now);
  assert.ok(grant);
  assert.equal(grant.memoraOwnerId,owner);
  assert.equal(check().allowed,true);
  assert.equal(check().reason,"AUTHORIZED");
});
test("default disabled and explicit revocation fail closed",()=>{
  assert.equal(evaluateNexusIdentity083({},principal,email,now).reason,"DISABLED");
  assert.equal(check({NEXUS_MEMORA2_IDENTITY_REVOKED:"true"}).reason,"REVOKED");
  assert.equal(check({NEXUS_MEMORA2_IDENTITY_REVOKED:undefined}).reason,"REVOKED");
  assert.equal(check({NEXUS_MEMORA2_IDENTITY_APPROVED:"false"}).reason,"DISABLED");
});
test("a user with matching email but wrong database ID is rejected",()=>{
  assert.equal(check({}, {...principal,id:"other_user_000083"}).reason,"SUBJECT_MISMATCH");
  assert.equal(check({},null).reason,"SUBJECT_MISMATCH");
});
test("staff, demo, wrong session email or bridge recipient cannot be authorized",()=>{
  assert.equal(check({}, {...principal,role:"STAFF"}).reason,"ROLE_DENIED");
  assert.equal(check({}, {...principal,email:"outsider@example.test"}).reason,"EMAIL_MISMATCH");
  assert.equal(check({},principal,"outsider@example.test").reason,"EMAIL_MISMATCH");
  assert.equal(check({NEXUS_MEMORA2_APPROVED_NEXUS_EMAIL:"demo@nexus.invalid"}).reason,"INVALID_GRANT");
});
test("short grant expires, malformed or far-future timestamps rejected",()=>{
  assert.equal(check({},principal,email,Date.parse("2026-11-14T00:00:00.001Z")).reason,"EXPIRED");
  assert.equal(check({NEXUS_MEMORA2_GRANT_EXPIRES_UTC:"2026-12-20T00:00:00.000Z"}).reason,"INVALID_GRANT");
  assert.equal(check({NEXUS_MEMORA2_GRANT_EXPIRES_UTC:"not-a-date"}).reason,"INVALID_GRANT");
  assert.equal(check({NEXUS_MEMORA2_GRANT_EXPIRES_UTC:"2026-11-31T00:00:00.000Z"}).reason,"INVALID_GRANT");
});
test("invalid owner or grant ID rejected",()=>{
  assert.equal(check({NEXUS_MEMORA2_APPROVED_MEMORA_OWNER_ID:"another-user"}).reason,"INVALID_GRANT");
  assert.equal(check({NEXUS_MEMORA2_ACCESS_GRANT_ID:"x"}).reason,"INVALID_GRANT");
  assert.equal(check({NEXUS_MEMORA2_APPROVED_NEXUS_USER_ID:"bad id"}).reason,"INVALID_GRANT");
});
test("only redacted status leaves identity gate; no ID or email leak",()=>{
  const s=JSON.stringify(redactedIdentityDecision083(check()));
  assert.deepEqual(JSON.parse(s),{allowed:true,status:"ALLOWED"});
  for(const privateText of [owner,email,principal.id,config.NEXUS_MEMORA2_ACCESS_GRANT_ID])
    assert.ok(!s.includes(privateText));
});
test("actual API and protected page reject when identity grant missing",()=>{
  const route=readFileSync("src/app/api/nexus/memora2/readiness/route.ts","utf8");
  const page=readFileSync("src/app/dashboard/nexus/rea/memora2-live/page.tsx","utf8");
  assert.match(route,/evaluateNexusIdentity083\(process\.env/);
  assert.match(route,/if\(!decision\.allowed\)/);
  assert.match(page,/evaluateNexusIdentity083\(process\.env/);
  assert.match(page,/notFound\(\)/);
  assert.doesNotMatch(route,/console\.log|NEXUS_MEMORA2_BRIDGE_SECRET/);
});
