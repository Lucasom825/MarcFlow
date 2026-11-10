import test from "node:test";
import assert from "node:assert/strict";
import { allowNexusDemoApi, DEMO_SESSION_ID } from "../../src/lib/nexus-demo-policy.ts";

const PERMITTED = [
  ["GET", "/api/auth/session"], ["GET", "/api/auth/csrf"],
  ["POST", "/api/auth/callback/credentials"], ["POST", "/api/auth/signout"],
  ["GET", "/api/sessions"], ["GET", "/api/notifications"],
  ["GET", `/api/flows/${DEMO_SESSION_ID}`], ["POST", `/api/flows/${DEMO_SESSION_ID}`],
  ["GET", `/api/flows/${DEMO_SESSION_ID}/meta`],
  ["GET", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow`],
  ["PUT", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow/draft`],
];
const REFUSED = [
  ["POST", "/api/auth/register"], ["GET", "/api/auth/register"],
  ["POST", "/api/sessions"], ["DELETE", "/api/sessions"],
  ["POST", "/api/system/check-updates"], ["PATCH", "/api/settings"],
  ["GET", "/api/chats"], ["POST", "/api/messages/send"],
  ["POST", "/api/socket/io"], ["GET", "/api/socket/io"],
  ["POST", "/api/whatsapp/connect"], ["POST", "/api/broadcasts"],
  ["GET", "/api/flows/another_session"],
  ["POST", "/api/flows/another_session"],
  ["PUT", "/api/flows/another_session/a/draft"],
  ["POST", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow/publish`],
  ["POST", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow/test`],
  ["DELETE", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow`],
  ["PATCH", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow`],
  ["POST", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow/activate`],
  ["PUT", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow/publish`],
  ["GET", `/api/flows/${DEMO_SESSION_ID}/nexus_demo_first_flow/assets`],
  ["GET", `/api/flows/${DEMO_SESSION_ID}/a/b/c`],
  ["PUT", `/api/flows/${DEMO_SESSION_ID}/meta`],
];
for(const [method,path] of PERMITTED)
  test(`allows demo ${method} ${path}`, () => assert.equal(allowNexusDemoApi(path,method),true));
for(const [method,path] of REFUSED)
  test(`denies demo ${method} ${path}`, () => assert.equal(allowNexusDemoApi(path,method),false));

test("credential callback path does not admit arbitrary flow writes",() => {
  assert.equal(allowNexusDemoApi("/api/flows/nexus_demo_session/a/draft", "POST"),false);
  assert.equal(allowNexusDemoApi("/api/flows/nexus_demo_session/a/draft", "PATCH"),false);
  assert.equal(allowNexusDemoApi("/api/flows/nexus_demo_session/a/draft", "DELETE"),false);
});
test("wildcards and encoded alternate sessions fail closed", () => {
  for(const p of ["/api/flows/nexus_demo_session2/a", "/api/flows/nexus_demo_session%2Fother/a", "/api/flows//nexus_demo_session/a", "/api/auth/register/extra"])
    assert.equal(allowNexusDemoApi(p, "POST"),false);
});
