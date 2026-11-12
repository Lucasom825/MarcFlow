import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  buildReaReuseDossier,formatReaReuseDossier,inferRoleFromName,
  pinnedSourceUrl,REA_REUSE_PROJECTS,type Rea073Report
} from "../../src/lib/nexus-rea-reuse-073";

const express:Rea073Report={
  run_id:43274412800,status:"COBERTURA_ESTRUTURAL_COM_RESSALVAS",
  target:{repository:"expressjs/express",commit:"43fca52d28a422c8be48fd489cbd4f2d6152bab6",directory:"lib"},
  checks:{ast_js_files:6,rea_parsed_js:6,ast_import_sites:57,matched_import_sites:57,
    ast_unique_internal_import_pairs:6,additional_rea_unreconciled:5,rea_semantic_unknowns:2518},
  structural_hubs:[{module:"utils.js",direct_dependents:2},{module:"request.js",direct_dependents:1}],
  uncertainties:["NONLITERAL_DYNAMIC_IMPORTS_NOT_RESOLVED"],
  evidence_id:"ev_6b4aa2b4935761c58423693a1a14ff55b53adb2ba4b050ef88c63ad9f21bb569",
  report_sha256:"cdf4355e75efd62670d8bbeabbd0264dd2f2d3e74e3aa44d69ff416b8ec20ad9",
  source_executed:false,behavior_test_verified:false,
};

test("Express real-run evidence maps to bounded investigation, never approval",()=>{
 const dossier=buildReaReuseDossier(express,"NEXUS","utils.js");
 assert.ok(dossier);
 assert.equal(dossier.decision,"EM_INVESTIGAÇÃO — NÃO APROVADO PARA REUTILIZAÇÃO");
 assert.equal(dossier.project,"NEXUS");
 assert.equal(dossier.module,"utils.js");
 assert.match(dossier.hypothesis,/Nome sugere/);
 assert.ok(dossier.observed.some(v=>v.includes("Dependentes diretos identificados: 2")));
 assert.ok(dossier.observed.some(v=>v.includes("Execução do código-alvo: não realizada")));
 assert.ok(dossier.pending.some(v=>v.includes("Conferir licença")));
 assert.ok(dossier.pending.some(v=>v.includes("Criar teste funcional isolado")));
 assert.ok(dossier.limitations.some(v=>v.includes("2518")));
 assert.equal(dossier.sourceUrl,
   "https://github.com/expressjs/express/blob/43fca52d28a422c8be48fd489cbd4f2d6152bab6/lib/utils.js");
});

test("role hypotheses are explicitly uncertain and never guarantee functions",()=>{
 assert.match(inferRoleFromName("request.js"),/ainda não comprovado/);
 assert.match(inferRoleFromName("response.js"),/ainda não comprovado/);
 assert.match(inferRoleFromName("view.js"),/ainda não comprovado/);
 assert.match(inferRoleFromName("custom.js"),/necessária leitura humana/);
});
test("candidate must come from the verified structural hubs",()=>{
 assert.equal(buildReaReuseDossier(express,"Liame","not-in-report.js"),null);
 assert.equal(buildReaReuseDossier(express,"Eventus","../env.js"),null);
 assert.equal(buildReaReuseDossier(express,"unknown" as any,"utils.js"),null);
 assert.equal(REA_REUSE_PROJECTS.length,5);
});
test("pinned source URL refuses unsafe paths and unpinned refs",()=>{
 assert.equal(pinnedSourceUrl(express,"../../secrets"),null);
 assert.equal(pinnedSourceUrl(express,"/etc/passwd"),null);
 assert.equal(pinnedSourceUrl({...express,target:{...express.target,commit:"main"}},"utils.js"),null);
 assert.equal(pinnedSourceUrl({...express,target:{...express.target,repository:"https://bad.invalid"}},"utils.js"),null);
 assert.equal(pinnedSourceUrl({...express,target:{...express.target,directory:"../private"}},"utils.js"),null);
});
test("exported dossier labels evidence, hypotheses, pending gates and source run",()=>{
 const text=formatReaReuseDossier(express,"Memora","request.js","Projeto piloto em ambiente isolado");
 assert.match(text,/NÃO APROVADO/);
 assert.match(text,/Execução verificada: #43274412800/);
 assert.match(text,/FATOS:/);
 assert.match(text,/HIPÓTESE PELO NOME \(NÃO COMPROVADA\):/);
 assert.match(text,/VERIFICAÇÕES PENDENTES:/);
 assert.match(text,/Projeto piloto em ambiente isolado/);
 assert.doesNotMatch(text,/compatibilidade confirmada|segurança comprovada/);
});
test("NEXUS073 uses the authenticated existing read-only run API and no writes",()=>{
 const view=readFileSync("src/components/nexus/rea-reuse-073.tsx","utf8");
 const page=readFileSync("src/app/dashboard/nexus/rea/reuse/page.tsx","utf8");
 const link=readFileSync("src/components/nexus/rea-run-072.tsx","utf8");
 assert.match(view,/\/api\/nexus\/rea\/jobs\//);
 assert.match(view,/method:"GET",credentials:"same-origin"/);
 assert.match(view,/Copiar dossiê de investigação/);
 assert.match(view,/NÃO APROVADO PARA REUTILIZAÇÃO/);
 assert.match(page,/rea_run/);
 assert.match(link,/dashboard\/nexus\/rea\/reuse\?rea_run/);
 for(const source of [view,page]){
   assert.doesNotMatch(source,/dangerouslySetInnerHTML|eval\(|new Function\(|sessionStorage|localStorage/);
   assert.doesNotMatch(source,/method:"POST"|method:"DELETE"|fetch\("https:\/\/api\.github\.com/);
 }
});
