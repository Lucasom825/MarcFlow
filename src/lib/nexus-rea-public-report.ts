/**
 * NEXUS 069 — strict read-only viewer of a publicly published REA result.
 * No token or source-code execution. Evidence belongs to public GitHub.
 */
const PUBLIC_REA_REPO = "Lucasom825/rea";
const PUBLIC_REA_BRANCH = "nexus/rea-axios-lib-068-20261111";
export const REA_REPORT_CONTENT_PATH = "/repos/" + PUBLIC_REA_REPO
  + "/contents/nexus-pilot/public-reports/axios-lib-latest.json?ref=" + PUBLIC_REA_BRANCH;
const EXPECTED_COMMIT="4ee8d46fc463770b8f5da718d5449a5b027b2c08";
const EXPECTED_WORKFLOW=".github/workflows/nexus-rea-axios-once-068.yml";
const STATUS=["COBERTURA_ESTRUTURAL_CONFIRMADA","COBERTURA_ESTRUTURAL_COM_RESSALVAS","INCONCLUSIVO"];
export class ReaPublicReportError extends Error {
  constructor(public code:string,message:string){super(message);}
}
const requiredMetrics=[
  "ast_js_files","rea_parsed_js","rea_parse_failures",
  "ast_import_sites","matched_import_sites","ast_unique_internal_import_pairs",
  "additional_rea_unreconciled","rea_semantic_unknowns",
] as const;
export type PublicReaReport = {
  schema:"NEXUS_REA_PUBLIC_SUMMARY_V1";
  source:"Lucasom825/rea";
  run_id:number; artifact_id:number; run_url:string;
  target:{repository:"axios/axios";commit:string;directory:"lib"};
  created_at:string;status:string;evidence_id:string;report_sha256:string;
  checks: Record<(typeof requiredMetrics)[number],number>&{source_executed:false;behavior_test_verified:false};
  uncertainties:string[];structural_hubs:{module:string;direct_dependents:number}[];
  limitations:string[];
};
export function validateReaSummary(input:unknown):PublicReaReport {
  if (!input || typeof input!=="object" || Array.isArray(input))
    throw new ReaPublicReportError("INVALID_REPORT","Relatório publicado inválido.");
  const r=input as Record<string,any>, c=r.checks??{};
  if (r.schema!=="NEXUS_REA_PUBLIC_SUMMARY_V1" || r.source!==PUBLIC_REA_REPO ||
      r.target?.repository!=="axios/axios" || r.target?.directory!=="lib" ||
      r.target?.commit!==EXPECTED_COMMIT || !STATUS.includes(r.status) ||
      !Number.isSafeInteger(r.run_id) || r.run_id<1 ||
      !Number.isSafeInteger(r.artifact_id) || r.artifact_id<1 ||
      r.run_url!=="https://github.com/"+PUBLIC_REA_REPO+"/actions/runs/"+r.run_id ||
      typeof r.report_sha256!=="string" || !/^[a-f0-9]{64}$/.test(r.report_sha256) ||
      typeof r.evidence_id!=="string" || !/^ev_[a-f0-9]{64}$/.test(r.evidence_id) ||
      typeof r.created_at!=="string" || !Number.isFinite(Date.parse(r.created_at)) ||
      c.source_executed!==false || c.behavior_test_verified!==false)
    throw new ReaPublicReportError("INVALID_REPORT","A identidade ou origem do relatório não conferem.");
  for(const k of requiredMetrics) if(!Number.isSafeInteger(c[k]) || c[k]<0 || c[k]>1_000_000)
    throw new ReaPublicReportError("INVALID_METRIC","Métrica inválida: "+k);
  if(c.rea_parsed_js!==c.ast_js_files || c.matched_import_sites>c.ast_import_sites)
    throw new ReaPublicReportError("INVALID_METRIC","Métricas do relatório são inconsistentes.");
  const textArray=(x:unknown,max:number,count:number)=>{
    if(!Array.isArray(x) || x.length>count ||
       x.some(v=>typeof v!=="string"||v.length>max))throw new ReaPublicReportError("INVALID_REPORT","Texto de relatório inválido.");
    return x as string[];
  };
  textArray(r.uncertainties,160,12);
  textArray(r.limitations,240,8);
  if(!Array.isArray(r.structural_hubs) || r.structural_hubs.length>8 ||
     r.structural_hubs.some((h:Record<string,unknown>)=>!h || typeof h.module!=="string" ||
       h.module.length>120 || !Number.isSafeInteger(h.direct_dependents) ||
       (h.direct_dependents as number)<0 || (h.direct_dependents as number)>100000))
    throw new ReaPublicReportError("INVALID_REPORT","Mapa de dependências inválido.");
  return r as PublicReaReport;
}
export function verifyRunMetadata(report:PublicReaReport, response:unknown):void {
  const run=response as Record<string,any> | null;
  if (!run || run.id!==report.run_id || run.status!=="completed" ||
      run.conclusion!=="success" || run.event!=="push" ||
      run.head_branch!==PUBLIC_REA_BRANCH || run.path!==EXPECTED_WORKFLOW ||
      run.repository?.full_name!==PUBLIC_REA_REPO)
    throw new ReaPublicReportError("UNVERIFIED_RUN","Execução GitHub não confirmada. Relatório não exibido como validado.");
}
export async function loadVerifiedPublicReaReport(
  getJSON:(path:string)=>Promise<unknown>
):Promise<PublicReaReport> {
  const content=await getJSON(REA_REPORT_CONTENT_PATH) as Record<string,any>;
  if(!content||content.type!=="file"||content.encoding!=="base64"||
     typeof content.content!=="string"||content.content.length>80_000)
    throw new ReaPublicReportError("NOT_PUBLISHED","Resumo público da REA ainda não disponível.");
  const decoded=Buffer.from(content.content.replace(/\n/g,""),"base64");
  if(!decoded.length || decoded.length>40_000)
    throw new ReaPublicReportError("INVALID_REPORT","Resumo excedeu os limites.");
  let parsed:unknown;
  try{parsed=JSON.parse(decoded.toString("utf8"));}
  catch{throw new ReaPublicReportError("INVALID_REPORT","JSON publicado inválido.");}
  const report=validateReaSummary(parsed);
  const runPath="/repos/"+PUBLIC_REA_REPO+"/actions/runs/"+report.run_id;
  verifyRunMetadata(report,await getJSON(runPath));
  return report;
}
const ALLOWED_RUN=/^\/repos\/Lucasom825\/rea\/actions\/runs\/[1-9][0-9]{0,15}$/;
export async function fetchPublicReaGitHub(path:string):Promise<unknown> {
  if(path!==REA_REPORT_CONTENT_PATH && !ALLOWED_RUN.test(path))
    throw new ReaPublicReportError("BAD_ENDPOINT","Rota não autorizada.");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try {
    const r=await fetch("https://api.github.com"+path,{
      headers:{"Accept":"application/vnd.github+json","User-Agent":"nexus069-public-report-reader"},
      cache:"no-store",redirect:"error",signal:controller.signal
    });
    if(r.status===404)throw new ReaPublicReportError("NOT_PUBLISHED","Relatório ainda não publicado.");
    if(r.status===403 || r.status===429)throw new ReaPublicReportError("RATE_LIMIT","Limite de consultas públicas ao GitHub atingido.");
    if(!r.ok)throw new ReaPublicReportError("GITHUB_ERROR","GitHub não respondeu ("+r.status+").");
    const advertised=Number(r.headers.get("content-length")||0);
    if(advertised>130000)throw new ReaPublicReportError("OVERSIZE","Resposta GitHub muito grande.");
    const data=await r.text();
    if(data.length>130000)throw new ReaPublicReportError("OVERSIZE","Resposta GitHub muito grande.");
    return JSON.parse(data);
  } finally {clearTimeout(timeout);}
}
