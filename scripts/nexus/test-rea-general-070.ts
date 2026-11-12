import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRea070Request,validateRea070Request,dispatchRea070,getRea070RunState,validateRunId,
  Rea070Error,reaDispatchReady,runInfoPath,runSummaryPath,fetchRea070Public,
  classifyReaDispatchFailure,checkReaCredential
} from "../../src/lib/nexus-rea-general-070";
import {allowNexusDemoApi} from "../../src/lib/nexus-demo-policy";
import {chooseReaDefaultDirectory} from "../../src/lib/nexus-rea-scope-071";

const sha="a".repeat(40);
const request={repository:"axios/axios",commit:sha,directory:"lib"};
test("only bounded public repo, 40-digit commit and safe directory accepted",()=>{
 assert.deepEqual(parseRea070Request(request),request);
 for(const invalid of [
  {...request,repository:"https://github.com/axios/axios"},
  {...request,repository:"../axios"},{...request,repository:"axios/.git"},
  {...request,commit:"main"},{...request,directory:"../../etc/passwd"},
  {...request,directory:"/lib"},{...request,directory:"lib//a"},{...request,directory:"lib space"},
 ])assert.throws(()=>parseRea070Request(invalid),Rea070Error);
});
test("default REA scope prefers actual application sources over Axios tests",()=>{
 assert.equal(chooseReaDefaultDirectory(["tests","lib","examples"]),"lib");
 assert.equal(chooseReaDefaultDirectory(["test","src","docs"]),"src");
 assert.equal(chooseReaDefaultDirectory(["__tests__","fixtures","packages/core"]),"packages/core");
 assert.equal(chooseReaDefaultDirectory(["tests"]),"tests");
 assert.equal(chooseReaDefaultDirectory([]),"");
});

test("full server re-validation rejects stale SHA, license and unexpected scope",async()=>{
 const good={license_allowlisted_for_toolkit:true,pinned_sha:sha,candidate_js_directories:["lib"],javascript_files:72};
 const mock=(value:Record<string,unknown>)=>async()=>({...good,...value});
 const verified=await validateRea070Request(request,mock({}) as any);
 assert.deepEqual(verified,request);
 for(const extra of [
  {pinned_sha:"b".repeat(40)},{license_allowlisted_for_toolkit:false},
  {candidate_js_directories:["src"]},{javascript_files:0}
 ])await assert.rejects(()=>validateRea070Request(request,mock(extra) as any),Rea070Error);
});
test("server cannot dispatch without a mounted secret; shell environment is ignored",async()=>{
 const old=process.env.NEXUS_REA_DISPATCH_TOKEN_FILE;
 const accidental=process.env.NEXUS_REA_DISPATCH_TOKEN;
 delete process.env.NEXUS_REA_DISPATCH_TOKEN_FILE;
 process.env.NEXUS_REA_DISPATCH_TOKEN="fake-token-that-must-not-enable-dispatch";
 try{
   assert.equal(reaDispatchReady(),false);
   await assert.rejects(()=>dispatchRea070(request),Rea070Error);
   assert.equal(reaDispatchReady(()=>"fake-unit-test-token"),true);
 }finally{
   if(old===undefined)delete process.env.NEXUS_REA_DISPATCH_TOKEN_FILE;
   else process.env.NEXUS_REA_DISPATCH_TOKEN_FILE=old;
   if(accidental===undefined)delete process.env.NEXUS_REA_DISPATCH_TOKEN;
   else process.env.NEXUS_REA_DISPATCH_TOKEN=accidental;
 }
});
test("dispatch uses only fixed API host, branch, workflow and public source-only inputs",async()=>{
 let called=false;
 const http=async(url:string|URL|Request,init?:RequestInit)=>{
   called=true;
   assert.equal(String(url),"https://api.github.com/repos/Lucasom825/rea/actions/workflows/nexus-rea-toolkit.yml/dispatches");
   assert.equal(init?.method,"POST");
   assert.equal((init?.headers as Record<string,string>)?.["X-GitHub-Api-Version"],"2026-03-10");
   assert.deepEqual(JSON.parse(String(init?.body)),{
     ref:"nexus/rea-public-jobs-070-20261111",
     return_run_details:true,
     inputs:{target:"public",repository:"axios/axios",commit:sha,directory:"lib"}
   });
   return new Response(JSON.stringify({workflow_run_id:43012345000}),{status:200});
 };
 const out=await dispatchRea070(request,http as typeof fetch,()=>"fake-unit-test-only");
 assert.equal(called,true);assert.equal(out.status,"TRACKABLE");
 assert.equal(out.run_id,43012345000);
});
test("dispatch reports bounded GitHub errors without exposing upstream body or token",async()=>{
 const cases:[number,string,string|null][]=[
  [401,"GITHUB_AUTH_401",null],
  [403,"GITHUB_FORBIDDEN_403",null],
  [403,"GITHUB_RATE_LIMIT","0"],
  [404,"GITHUB_WORKFLOW_404",null],
  [422,"GITHUB_DISPATCH_422",null],
  [429,"GITHUB_RATE_LIMIT",null],
  [500,"DISPATCH_FAILED",null]
 ];
 for(const [status,code,remaining] of cases){
   const classified=classifyReaDispatchFailure(status,remaining);
   assert.equal(classified.code,code);
   assert.match(classified.message,new RegExp(String(status)));
   assert.doesNotMatch(classified.message,/secret-upstream-body|token-secret-value/);
   const mock=async()=>new Response("secret-upstream-body",{
     status,headers:remaining===null?{}:{"x-ratelimit-remaining":remaining}
   });
   await assert.rejects(
     ()=>dispatchRea070(request,mock as typeof fetch,()=>"token-secret-value"),
     (e:unknown)=>e instanceof Rea070Error && e.code===code &&
       !e.message.includes("secret-upstream-body") &&
       !e.message.includes("token-secret-value")
   );
 }
});

test("read-only credential diagnostic does not dispatch or expose token",async()=>{
 const calls:string[]=[];
 const valid=async(url:string|URL|Request,init?:RequestInit)=>{
   calls.push(String(url));
   assert.equal(String(url),"https://api.github.com/user");
   assert.equal(init?.method,"GET");
   assert.equal((init?.headers as Record<string,string>)?.Authorization,"Bearer synthetic-credential");
   assert.equal(init?.body,undefined);
   return new Response(JSON.stringify({login:"Lucasom825"}),{status:200});
 };
 assert.deepEqual(await checkReaCredential(valid as typeof fetch,()=>"synthetic-credential"),
   {status:"TOKEN_AUTHENTICATED",actions_write_verified:false});
 assert.deepEqual(await checkReaCredential(valid as typeof fetch,()=>""),{
   status:"TOKEN_MISSING",actions_write_verified:false
 });
 assert.deepEqual(calls,["https://api.github.com/user"]);
 const other=async()=>new Response(JSON.stringify({login:"different-account"}),{status:200});
 assert.equal((await checkReaCredential(other as typeof fetch,()=>"synthetic-credential")).status,
   "TOKEN_OTHER_ACCOUNT");
 const invalid=async()=>new Response(null,{status:401});
 assert.equal((await checkReaCredential(invalid as typeof fetch,()=>"synthetic-credential")).status,
   "TOKEN_REJECTED");
 const limited=async()=>new Response(null,{
   status:403,headers:{"x-ratelimit-remaining":"0"}
 });
 assert.equal((await checkReaCredential(limited as typeof fetch,()=>"synthetic-credential")).status,
   "RATE_LIMITED");
 const denied=async()=>new Response(null,{status:403});
 assert.equal((await checkReaCredential(denied as typeof fetch,()=>"synthetic-credential")).status,
   "GITHUB_FORBIDDEN");
 const broken=async()=>{throw new Error("synthetic-token-must-not-leak")};
 assert.equal((await checkReaCredential(broken as typeof fetch,()=>"synthetic-credential")).status,
   "UNAVAILABLE");
});

test("legacy 204 no-run-ID response is not invented",async()=>{
 const result=await dispatchRea070(request,(async()=>new Response(null,{status:204})) as typeof fetch,()=>"fake-unit-test");
 assert.deepEqual({state:result.status,id:result.run_id},{state:"SUBMITTED_UNTRACKED",id:null});
});
test("status is restricted to correct workflow branch and event",async()=>{
 const runId=43012345000,repo="Lucasom825/rea";
 const run={id:runId,status:"completed",conclusion:"success",path:".github/workflows/nexus-rea-toolkit.yml",head_branch:"nexus/rea-public-jobs-070-20261111",event:"workflow_dispatch",repository:{full_name:repo}};
 const report={
   schema:"NEXUS_REA_PUBLIC_SUMMARY_V1",source:repo,run_id:runId,
   run_url:"https://github.com/"+repo+"/actions/runs/"+runId,artifact_id:6001,
   status:"COBERTURA_ESTRUTURAL_COM_RESSALVAS",report_sha256:"f".repeat(64),
   artifact_id:6001,evidence_id:"ev_"+"e".repeat(64),created_at:"2026-11-12T17:34:27.760Z",
   structural_hubs:[{module:"utils.js",direct_dependents:30}],
   uncertainties:["REA_EXTRA_SITES_WITH_OTHER_SOURCE_LINE"],
   target:{repository:"axios/axios",directory:"lib",commit:sha},
   checks:{source_executed:false,behavior_test_verified:false,ast_js_files:72,rea_parsed_js:72,
    matched_import_sites:200,ast_import_sites:200,
    ast_unique_internal_import_pairs:178,additional_rea_unreconciled:7,
    rea_semantic_unknowns:13641}
 };
 const get=async(path:string)=>{
   if(path===runInfoPath(runId))return run;
   if(path===runSummaryPath(runId))return {type:"file",encoding:"base64",content:Buffer.from(JSON.stringify(report)).toString("base64")};
   throw Error("Unexpected "+path);
 };
 const out=await getRea070RunState(runId,get as typeof fetchRea070Public);
 assert.equal(out.state,"completed");assert.equal(out.report?.status,report.status);
 assert.deepEqual((out.report as Record<string,any>)?.structural_hubs,report.structural_hubs);
 assert.deepEqual((out.report as Record<string,any>)?.uncertainties,report.uncertainties);
 assert.equal((out.report as Record<string,any>)?.evidence_id,report.evidence_id);
 assert.equal((out.report as Record<string,any>)?.checks?.rea_semantic_unknowns,13641);
 for(const tampered of [
  {...report,evidence_id:"invalid"},
  {...report,structural_hubs:[{module:"../secret",direct_dependents:30}]},
  {...report,structural_hubs:[{module:"utils.js",direct_dependents:-1}]},
  {...report,checks:{...report.checks,matched_import_sites:201}},
  {...report,uncertainties:["X".repeat(200)]}
 ]){
   const getAltered=async(path:string)=>{
     if(path===runInfoPath(runId))return run;
     if(path===runSummaryPath(runId))return {
       type:"file",encoding:"base64",content:Buffer.from(JSON.stringify(tampered)).toString("base64")
     };
     throw Error("Unexpected "+path);
   };
   await assert.rejects(()=>getRea070RunState(runId,getAltered as typeof fetchRea070Public),
     (e:unknown)=>e instanceof Rea070Error && e.code==="INVALID_SUMMARY");
 }
 for(const bad of [
   {...run,head_branch:"main"},{...run,event:"push"},{...run,id:33},
   {...run,path:"secrets.yml"},{...run,repository:{full_name:"other/repo"}}
 ])await assert.rejects(()=>getRea070RunState(runId,(async()=>bad) as typeof fetchRea070Public),Rea070Error);
});
test("pending and failing runs never claim successful analysis",async()=>{
 const id=43012345000;
 const info={id,status:"in_progress",conclusion:null,head_branch:"nexus/rea-public-jobs-070-20261111",
 path:".github/workflows/nexus-rea-toolkit.yml",event:"workflow_dispatch",repository:{full_name:"Lucasom825/rea"}};
 const pending=await getRea070RunState(id,(async()=>info) as typeof fetchRea070Public);
 assert.equal(pending.state,"in_progress");assert.equal(pending.report,null);
 const failed=await getRea070RunState(id,(async()=>({...info,status:"completed",conclusion:"failure"})) as typeof fetchRea070Public);
 assert.equal(failed.state,"failed");assert.equal(failed.report,null);
});
test("demo API firewall allows only intended methods/routes, no source execution",()=>{
 assert.equal(allowNexusDemoApi("/api/nexus/rea/config","GET"),true);
 assert.equal(allowNexusDemoApi("/api/nexus/rea/request","POST"),true);
 assert.equal(allowNexusDemoApi("/api/nexus/rea/jobs/43012345000","GET"),true);
 for(const [path,method] of [
  ["/api/nexus/rea/request","GET"],["/api/nexus/rea/request","DELETE"],
  ["/api/nexus/rea/config","POST"],["/api/nexus/rea/jobs/43012345000","POST"],
  ["/api/nexus/rea/jobs/../../token","GET"],["/api/nexus/rea/jobs/0","GET"],
  ["/api/nexus/rea/publish","POST"],["/api/nexus/rea/deploy","POST"],
 ])assert.equal(allowNexusDemoApi(path,method),false);
 assert.throws(()=>validateRunId("../../secrets"),Rea070Error);
});
test("fixed GitHub GET path cannot be rewritten into SSRF",async()=>{
 await assert.rejects(()=>fetchRea070Public("https://evil.example"),Rea070Error);
 await assert.rejects(()=>fetchRea070Public("/repos/Lucasom825/rea/actions/runs/1/../../token"),Rea070Error);
});
