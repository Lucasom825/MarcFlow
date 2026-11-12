import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("NEXUS072 per-run UI reads only the validated REA jobs endpoint",()=>{
 const view=readFileSync("src/components/nexus/rea-run-072.tsx","utf8");
 assert.match(view,/\/api\/nexus\/rea\/jobs\//);
 assert.match(view,/credentials:"same-origin"/);
 assert.match(view,/Rea072RunPanel/);
 assert.match(view,/structural_hubs\.map/);
 assert.match(view,/rea_semantic_unknowns/);
 assert.match(view,/report_sha256/);
 assert.match(view,/Nenhum código externo foi executado/);
 assert.doesNotMatch(view, /dangerouslySetInnerHTML|eval\(|new Function\(|fetch\("https:\/\/api\.github\.com/);
});
test("NEXUS072 retains only one run poller and links it to dispatch",()=>{
 const request=readFileSync("src/components/nexus/rea-070-request.tsx","utf8");
 const page=readFileSync("src/app/dashboard/nexus/rea/page.tsx","utf8");
 assert.match(request,/setRunId\(data\.run_id\)/);
 assert.match(request,/Rea072RunPanel runId=\{runId\}/);
 assert.doesNotMatch(request,/setInterval\(/);
 assert.match(page,/resumeRunId/);
 assert.match(page,/new URLSearchParams\(window\.location\.search\)/);
 assert.match(page,/!result && resumeRunId && <Rea072RunPanel/);
 assert.doesNotMatch(page,/localStorage|sessionStorage/);
});
test("NEXUS072 server validates scope and provenance, no arbitrary URL fetch",()=>{
 const server=readFileSync("src/lib/nexus-rea-general-070.ts","utf8");
 const route=readFileSync("src/app/api/nexus/rea/jobs/[id]/route.ts","utf8");
 assert.match(server,/report\.structural_hubs/);
 assert.match(server,/report\.evidence_id/);
 assert.match(server,/report\.report_sha256/);
 assert.match(server,/report\.uncertainties/);
 assert.match(server,/get\(runInfoPath\(runId\)\)/);
 assert.match(route,/await auth\(\)/);
 assert.match(route,/getRea070RunState\(validateRunId\(id\)\)/);
});
