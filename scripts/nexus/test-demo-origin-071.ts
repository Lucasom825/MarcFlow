import test from "node:test";
import assert from "node:assert/strict";
import {isAuthorizedReaDemoOrigin,diagnoseReaDemoOrigin} from "../../src/lib/nexus-rea-demo-origin";
const publicOrigin="https://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev";
test("GitHub Codespaces forwarded HTTPS origin equals trusted AUTH_URL",()=>{
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin, publicOrigin),true);
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin, publicOrigin+"/"),true);
  // A Next.js request can have internal origin localhost:39164 behind the proxy,
  // but the browser origin must be validated against AUTH_URL instead.
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin,"http://localhost:39164"),false);
});
test("no untrusted Host or X-Forwarded-Host bypasses strict AUTH_URL",()=>{
  const rejected=[
    "https://evil.example", "https://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev.evil.example",
    "http://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev",
    "https://automatic-space-system-4jw456q6ppjr265x-39165.app.github.dev",
    "https://other-codespace-39164.app.github.dev",
    publicOrigin+"/api/nexus/rea/request", publicOrigin+"?x=1", publicOrigin+"#payload",
    "null","", "https://attacker.example@automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev",
    "https://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev/",
  ];
  for(const origin of rejected)assert.equal(isAuthorizedReaDemoOrigin(origin,publicOrigin),false,origin);
  assert.equal(isAuthorizedReaDemoOrigin(null,publicOrigin),false);
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin,undefined),false);
});
test("public HTTP trusted URL and URL with path or credentials are rejected",()=>{
  assert.equal(isAuthorizedReaDemoOrigin("http://badhost.example","http://badhost.example"),false);
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin,publicOrigin+"/auth/login"),false);
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin,publicOrigin+"?token=example"),false);
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin,"https://user:pass@automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev"),false);
  assert.equal(isAuthorizedReaDemoOrigin(publicOrigin,"javascript:alert(1)"),false);
});
test("localhost origin remains available only in explicitly configured local demo",()=>{
  assert.equal(isAuthorizedReaDemoOrigin("http://localhost:39164","http://localhost:39164"),true);
  assert.equal(isAuthorizedReaDemoOrigin("http://127.0.0.1:39164","http://127.0.0.1:39164"),true);
  assert.equal(isAuthorizedReaDemoOrigin("http://localhost:39164","https://localhost:39164"),false);
});

test("diagnostics identify the exact class of origin failure without exposing URLs or token values",()=>{
  const good=publicOrigin;
  const cases=[
    [good,good,"ORIGIN_OK"],
    [null,good,"ORIGIN_HEADER_MISSING"],
    [good,undefined,"AUTH_URL_MISSING"],
    [good,"not-a-url","AUTH_URL_INVALID"],
    [good,good+"/auth/login","AUTH_URL_INVALID"],
    [good+"/a",good,"BROWSER_ORIGIN_INVALID"],
    ["null",good,"BROWSER_ORIGIN_INVALID"],
    ["https://other.example",good,"ORIGIN_MISMATCH"],
  ] as const;
  for(const [caller,configured,expected] of cases){
    const result=diagnoseReaDemoOrigin(caller,configured);
    assert.equal(result,expected);
    assert.equal(result.includes("github.dev"),false);
    assert.equal(result.includes("token"),false);
  }
});
