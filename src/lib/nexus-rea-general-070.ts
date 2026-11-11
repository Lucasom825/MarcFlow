/**
 * NEXUS 070: opt-in, bounded dispatch to the existing REA workflow.
 * Requires an independent GitHub Actions:write credential IN SERVER ENV only.
 * No credential in user-visible application, .env.nexus-demo or repository.
 */
import {inspectPublicRepo,fetchPublicGithub,PreflightError} from "@/lib/nexus-public-preflight";
export const REA_GENERAL_REF="nexus/rea-public-jobs-070-20261111";
export const REA_GENERAL_WORKFLOW="nexus-rea-toolkit.yml";
export const REA_GENERAL_REPO="Lucasom825/rea";
const TARGET_RE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,98}\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/;
const DIRECTORY_RE=/^[A-Za-z0-9_./@-]{1,180}$/;
const SHA_RE=/^[a-f0-9]{40}$/i;
export class Rea070Error extends Error {
  constructor(public code:string,message:string){super(message);}
}
export type NewReaRequest={repository:string;commit:string;directory:string};
export function parseRea070Request(value:unknown):NewReaRequest {
  if(!value || typeof value!=="object" || Array.isArray(value))throw new Rea070Error("INVALID_INPUT","Dados inválidos.");
  const o=value as Record<string,unknown>,{repository,commit,directory}=o;
  if(typeof repository!=="string" || !TARGET_RE.test(repository) ||
     repository.split("/").some(x=>x==="."||x===".."||x.endsWith(".git")) ||
     typeof commit!=="string" || !SHA_RE.test(commit) ||
     typeof directory!=="string" || !DIRECTORY_RE.test(directory) ||
     directory.split("/").some(x=>x==="."||x===".."||x===""))
     throw new Rea070Error("INVALID_INPUT","Informe repositório público, commit SHA de 40 caracteres e pasta JavaScript válida.");
  return {repository,commit:commit.toLowerCase(),directory};
}
export async function validateRea070Request(input:unknown,
    inspect:typeof inspectPublicRepo=inspectPublicRepo):Promise<NewReaRequest> {
  const value=parseRea070Request(input);
  const preview=await inspect(value.repository,fetchPublicGithub);
  if(!preview.license_allowlisted_for_toolkit)
    throw new Rea070Error("LICENSE_NOT_ALLOWED","Licença não autorizada para este piloto de análise.");
  if(preview.pinned_sha!==value.commit)
    throw new Rea070Error("STALE_COMMIT","O repositório mudou desde a pré-análise. Consulte novamente.");
  if(!preview.candidate_js_directories.includes(value.directory) || preview.javascript_files<=0)
    throw new Rea070Error("INVALID_DIRECTORY","A pasta escolhida não foi confirmada no inventário JavaScript.");
  return value;
}
export function reaDispatchReady():boolean{
  return Boolean(process.env.NEXUS_REA_DISPATCH_TOKEN?.trim());
}
export type DispatchResult={status:"TRACKABLE"|"SUBMITTED_UNTRACKED";run_id:number|null;workflow_url:string};
const RUN_RE=/^[1-9][0-9]{0,15}$/;
export function validateRunId(input:unknown):number{
  const s=String(input??"");
  if(!RUN_RE.test(s) || !Number.isSafeInteger(Number(s)))
    throw new Rea070Error("INVALID_RUN","Identificador de execução inválido.");
  return Number(s);
}
export async function dispatchRea070(input:NewReaRequest,
    http:typeof fetch=fetch):Promise<DispatchResult> {
  const token=process.env.NEXUS_REA_DISPATCH_TOKEN;
  if(!token?.trim())throw new Rea070Error("NOT_CONFIGURED","Conexão de autorização GitHub Actions ainda não configurada.");
  // Never accept caller-supplied branch, workflow, API host or headers.
  const url="https://api.github.com/repos/"+REA_GENERAL_REPO+"/actions/workflows/"+REA_GENERAL_WORKFLOW+"/dispatches";
  const controller=new AbortController();
  const abort=setTimeout(()=>controller.abort(),10000);
  let response:Response;
  try {
    response=await http(url,{
      method:"POST",redirect:"error",cache:"no-store",
      headers:{
        Accept:"application/vnd.github+json",
        "Content-Type":"application/json",
        "X-GitHub-Api-Version":"2026-03-10",
        Authorization:"Bearer "+token,
        "User-Agent":"NEXUS070-private-REA-dispatch"
      },
      body:JSON.stringify({
        ref:REA_GENERAL_REF,
        inputs:{target:"public",repository:input.repository,commit:input.commit,directory:input.directory}
      }),
      signal:controller.signal
    });
  } finally {clearTimeout(abort);}
  if(!response.ok)
    throw new Rea070Error("DISPATCH_FAILED",
      response.status===401 || response.status===403 ?
        "Autorização recusada pelo GitHub. Verifique permissão Actions:write restrita ao fork REA.":
        "Não foi possível iniciar o GitHub Actions (HTTP "+response.status+").");
  const workflow_url="https://github.com/"+REA_GENERAL_REPO+"/actions/workflows/"+REA_GENERAL_WORKFLOW;
  // Versioned GitHub API returns the run ID. Older versions may return 204.
  if(response.status===204)return {status:"SUBMITTED_UNTRACKED",run_id:null,workflow_url};
  let data:unknown=null;
  try{data=await response.json();}catch{ /* A successful dispatch can omit the run ID. */ }
  const obj=data as Record<string,unknown>|null;
  if(obj && obj.workflow_run_id!=null){
    const id=validateRunId(obj.workflow_run_id);
    return {status:"TRACKABLE",run_id:id,workflow_url};
  }
  return {status:"SUBMITTED_UNTRACKED",run_id:null,workflow_url};
}
export const REA_070_REPOSITORY_PATH="/repos/"+REA_GENERAL_REPO;
export function runInfoPath(id:number):string{
  return REA_070_REPOSITORY_PATH+"/actions/runs/"+validateRunId(id);
}
export function runSummaryPath(id:number):string{
  return REA_070_REPOSITORY_PATH+"/contents/nexus-pilot/public-reports/by-run/"+validateRunId(id)+".json?ref="+REA_GENERAL_REF;
}
export async function fetchRea070Public(path:string,http:typeof fetch=fetch):Promise<unknown>{
  const m=path.match(/^\/repos\/Lucasom825\/rea\/(?:actions\/runs\/([1-9][0-9]{0,15})|contents\/nexus-pilot\/public-reports\/by-run\/([1-9][0-9]{0,15})\.json\?ref=nexus\/rea-public-jobs-070-20261111)$/);
  if(!m)throw new Rea070Error("BAD_ENDPOINT","Rota não permitida.");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    const r=await http("https://api.github.com"+path,{
      method:"GET",redirect:"error",cache:"no-store",
      headers:{Accept:"application/vnd.github+json","User-Agent":"NEXUS070-public-run-reader"},signal:controller.signal
    });
    if(r.status===404)throw new Rea070Error("NOT_FOUND","Execução ou relatório ainda não disponível.");
    if(r.status===403 || r.status===429)throw new Rea070Error("RATE_LIMIT","Limite público de consultas ao GitHub atingido.");
    if(!r.ok)throw new Rea070Error("GITHUB_ERROR","Consulta GitHub falhou.");
    const size=Number(r.headers.get("content-length")||0);
    if(size>150000)throw new Rea070Error("OVERSIZE","Resposta muito grande.");
    const body=await r.text();
    if(body.length>150000)throw new Rea070Error("OVERSIZE","Resposta muito grande.");
    return JSON.parse(body);
  }finally{clearTimeout(timer);}
}
export type Rea070State={
  run_id:number;state:"queued"|"in_progress"|"completed"|"result_pending"|"failed";
  conclusion:string|null;url:string;report:null|Record<string,unknown>;
};
export async function getRea070RunState(id:number,
    get:typeof fetchRea070Public=fetchRea070Public):Promise<Rea070State>{
  const runId=validateRunId(id);
  const raw=await get(runInfoPath(runId)) as Record<string,unknown>;
  const repo=raw?.repository as Record<string,unknown>|undefined;
  if(raw.id!==runId || repo?.full_name!==REA_GENERAL_REPO ||
     raw.path!==".github/workflows/"+REA_GENERAL_WORKFLOW ||
     raw.head_branch!==REA_GENERAL_REF || raw.event!=="workflow_dispatch")
    throw new Rea070Error("UNVERIFIED_RUN","Execução não pertence ao piloto REA NEXUS 070.");
  const conclusion=typeof raw.conclusion==="string"?raw.conclusion:null;
  const url="https://github.com/"+REA_GENERAL_REPO+"/actions/runs/"+runId;
  const base={run_id:runId,conclusion,url,report:null};
  if(raw.status!=="completed")
    return {...base,state:raw.status==="queued"?"queued":"in_progress"};
  if(conclusion!=="success")return {...base,state:"failed"};
  try{
    const content=await get(runSummaryPath(runId)) as Record<string,unknown>;
    if(content.type!=="file" || content.encoding!=="base64" ||
       typeof content.content!=="string" || content.content.length>80000)
       throw new Rea070Error("INVALID_SUMMARY","Resumo público inválido.");
    const rawJson=Buffer.from(content.content.replace(/\n/g,""),"base64").toString("utf8");
    const report=JSON.parse(rawJson) as Record<string,unknown>;
    const target=report.target as Record<string,unknown>|undefined;
    const checks=report.checks as Record<string,unknown>|undefined;
    if(report.schema!=="NEXUS_REA_PUBLIC_SUMMARY_V1" ||
       report.source!==REA_GENERAL_REPO || report.run_id!==runId ||
       report.run_url!==url ||
       !target || typeof target.repository!=="string" || !TARGET_RE.test(target.repository) ||
       typeof target.commit!=="string" || !SHA_RE.test(target.commit) ||
       typeof target.directory!=="string" || !DIRECTORY_RE.test(target.directory) ||
       !checks || checks.source_executed!==false || checks.behavior_test_verified!==false ||
       !Number.isSafeInteger(checks.ast_js_files) || !Number.isSafeInteger(checks.rea_parsed_js) ||
       !Number.isSafeInteger(checks.matched_import_sites) ||
       !Number.isSafeInteger(checks.ast_import_sites) ||
       !Number.isSafeInteger(checks.additional_rea_unreconciled) ||
       !["INCONCLUSIVO","COBERTURA_ESTRUTURAL_COM_RESSALVAS","COBERTURA_ESTRUTURAL_CONFIRMADA"].includes(String(report.status)) ||
       typeof report.report_sha256!=="string" || !/^[a-f0-9]{64}$/.test(report.report_sha256))
       throw new Rea070Error("INVALID_SUMMARY","Resumo não validado.");
    // Only bounded fields. No dynamic rendering of the raw report or arbitrary URLs.
    const compact={
      target,run_id:runId,status:report.status,artifact_id:report.artifact_id,
      created_at:report.created_at,checks:{
        ast_js_files:checks.ast_js_files,rea_parsed_js:checks.rea_parsed_js,
        matched_import_sites:checks.matched_import_sites,
        ast_import_sites:checks.ast_import_sites,
        ast_unique_internal_import_pairs:checks.ast_unique_internal_import_pairs,
        additional_rea_unreconciled:checks.additional_rea_unreconciled
      },
      source_executed:false,behavior_test_verified:false
    };
    return {...base,state:"completed",report:compact};
  }catch(e){
    if(e instanceof Rea070Error && e.code==="NOT_FOUND")return {...base,state:"result_pending"};
    if(e instanceof Rea070Error)throw e;
    throw new Rea070Error("INVALID_SUMMARY","Não foi possível validar o resumo publicado.");

  }
}
