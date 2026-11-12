import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isAuthorizedReaDemoOrigin,diagnoseReaDemoOrigin,canonicalReaDemoPage} from "../../src/lib/nexus-rea-demo-origin";
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

test("REA checks independent immutable Codespaces URL, never Auth.js AUTH_URL or forwarded host",()=>{
  const route=readFileSync("src/app/api/nexus/rea/request/route.ts","utf8");
  const compose=readFileSync("scripts/nexus/compose.rea-071.secrets.yml","utf8");
  const bootstrap=readFileSync("scripts/nexus/start-codespace-066.sh","utf8");
  assert.match(route,/process\.env\.NEXUS_REA_ALLOWED_ORIGIN/);
  assert.doesNotMatch(route,/process\.env\.AUTH_URL/);
  assert.doesNotMatch(route,/request\.nextUrl\.origin/);
  assert.match(compose,/NEXUS_REA_ALLOWED_ORIGIN: \$\{NEXUS_DEMO_ORIGIN:\?/);
  assert.match(bootstrap,/export NEXUS_DEMO_ORIGIN="\$origin"/);
  assert.equal(diagnoseReaDemoOrigin(publicOrigin,publicOrigin),"ORIGIN_OK");
  assert.equal(diagnoseReaDemoOrigin("https://evil.example",publicOrigin),"ORIGIN_MISMATCH");
});


test("canonical URL points only to fixed Codespaces port and never disables origin guard",()=>{
  assert.equal(canonicalReaDemoPage(publicOrigin),publicOrigin+"/dashboard/nexus/rea");
  const refused=[
    "https://evil.example",
    "https://evil.example-39164.app.github.dev.evil.example",
    "https://automatic-space-system-4jw456q6ppjr265x-39165.app.github.dev",
    "http://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev",
    publicOrigin+"/auth/login",
    "https://a:pass@automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev",
    "https://automatic-space-system-4jw456q6ppjr265x-39164.app.github.dev:8443",
    "https://127.0.0.1",
  ];
  for(const bad of refused)assert.equal(canonicalReaDemoPage(bad),null,bad);
  assert.equal(canonicalReaDemoPage(undefined),null);
  assert.equal(isAuthorizedReaDemoOrigin("https://evil.example",publicOrigin),false);
});

test("canonical URL is read-only and available only on existing authenticated demo endpoint",()=>{
  const config=readFileSync("src/app/api/nexus/rea/config/route.ts","utf8");
  const request=readFileSync("src/app/api/nexus/rea/request/route.ts","utf8");
  const ui=readFileSync("src/components/nexus/rea-070-request.tsx","utf8");
  assert.match(config,/await auth\(\)/);
  assert.match(config,/canonicalReaDemoPage\(process\.env\.NEXUS_REA_ALLOWED_ORIGIN\)/);
  assert.match(request,/diagnoseReaDemoOrigin/);
  assert.match(request,/process\.env\.NEXUS_REA_ALLOWED_ORIGIN/);
  assert.match(ui,/wrongBrowserOrigin/);
  assert.match(ui,/disabled=\{!ready\|\|!allowed\|\|working\|\|wrongBrowserOrigin\}/);
});
