import test from "node:test";
import assert from "node:assert/strict";
import {
  validateReaSummary,verifyRunMetadata,loadVerifiedPublicReaReport,
  fetchPublicReaGitHub,REA_REPORT_CONTENT_PATH,ReaPublicReportError,
} from "../../src/lib/nexus-rea-public-report";
import {allowNexusDemoApi} from "../../src/lib/nexus-demo-policy";

const id=43076663802,artifact_id=13882073030;
const sha="4ee8d46fc463770b8f5da718d5449a5b027b2c08";
const sample={
 schema:"NEXUS_REA_PUBLIC_SUMMARY_V1",source:"Lucasom825/rea",run_id:id,artifact_id,
 run_url:"https://github.com/Lucasom825/rea/actions/runs/"+id,
 target:{repository:"axios/axios",commit:sha,directory:"lib"},
 status:"COBERTURA_ESTRUTURAL_COM_RESSALVAS",
 created_at:"2026-11-11T18:20:23.931Z",
 evidence_id:"ev_"+"b".repeat(64),report_sha256:"a".repeat(64),
 checks:{ast_js_files:72,rea_parsed_js:72,rea_parse_failures:0,
 ast_import_sites:200,matched_import_sites:200,ast_unique_internal_import_pairs:178,
 additional_rea_unreconciled:7,rea_semantic_unknowns:13641,
 source_executed:false,behavior_test_verified:false},
 uncertainties:["REA_EXTRA_SITES_WITH_OTHER_SOURCE_LINE"],structural_hubs:[{module:"utils.js",direct_dependents:30}],
 limitations:["No target source execution."]
};
const run={id,status:"completed",conclusion:"success",event:"push",head_branch:"nexus/rea-axios-lib-068-20261111",
 path:".github/workflows/nexus-rea-axios-once-068.yml",repository:{full_name:"Lucasom825/rea"}};
test("reads only strict public REA report tied to verified GitHub Actions success", async()=>{
 const paths:string[]=[];
 const get=async(path:string)=>{
   paths.push(path);
   if(path===REA_REPORT_CONTENT_PATH)return {type:"file",encoding:"base64",content:Buffer.from(JSON.stringify(sample)).toString("base64")};
   if(path==="/repos/Lucasom825/rea/actions/runs/"+id)return run;
   throw Error("unexpected "+path);
 };
 const actual=await loadVerifiedPublicReaReport(get);
 assert.equal(actual.checks.rea_parsed_js,72);
 assert.deepEqual(paths,[REA_REPORT_CONTENT_PATH,"/repos/Lucasom825/rea/actions/runs/"+id]);
});
test("refuses mismatched SHA, target, source execution, missing provenance, inflated numbers",()=>{
 const cases=[
  {...sample,target:{...sample.target,commit:"0".repeat(40)}},
  {...sample,target:{...sample.target,repository:"evil/repo"}},
  {...sample,checks:{...sample.checks,source_executed:true}},
  {...sample,checks:{...sample.checks,behavior_test_verified:true}},
  {...sample,checks:{...sample.checks,rea_parsed_js:1000001}},
  {...sample,checks:{...sample.checks,matched_import_sites:300}},
  {...sample,artifact_id:0},
  {...sample,run_url:"https://github.com/evil/repo"},
  {...sample,structural_hubs:[{module:"x",direct_dependents:-2}]},
 ];
 for(const bad of cases)assert.throws(()=>validateReaSummary(bad),ReaPublicReportError);
});
test("never treats a failed, skipped, unrelated or wrong-branch Actions run as verified",()=>{
 for(const bad of [
   {...run,conclusion:"failure"},{...run,status:"in_progress"},
   {...run,id:id+1},{...run,head_branch:"main"},
   {...run,path:".github/workflows/evil.yml"},
   {...run,repository:{full_name:"someone/rea"}},
   {...run,event:"workflow_dispatch"},
 ]) assert.throws(()=>verifyRunMetadata(sample as any,bad),ReaPublicReportError);
});
test("refuses missing publication, oversized or corrupt base64",async()=>{
 const err=(content:unknown)=>loadVerifiedPublicReaReport(async()=>content);
 await assert.rejects(err(null),ReaPublicReportError);
 await assert.rejects(err({type:"file",encoding:"base64",content:"z".repeat(90000)}),ReaPublicReportError);
 await assert.rejects(err({type:"file",encoding:"base64",content:Buffer.from("not json").toString("base64")}),ReaPublicReportError);
});
test("no SSRF and no write operation authorized in demonstration proxy",async()=>{
 assert.equal(allowNexusDemoApi("/api/nexus/rea/report","GET"),true);
 for(const m of ["POST","PUT","PATCH","DELETE"])
   assert.equal(allowNexusDemoApi("/api/nexus/rea/report",m),false);
 assert.equal(allowNexusDemoApi("/api/nexus/rea/reports/import","POST"),false);
 await assert.rejects(fetchPublicReaGitHub("https://example.com"),ReaPublicReportError);
 await assert.rejects(fetchPublicReaGitHub("/repos/Lucasom825/rea/issues"),ReaPublicReportError);
 await assert.rejects(fetchPublicReaGitHub("/repos/Lucasom825/rea/actions/runs/1/../../tokens"),ReaPublicReportError);
});
