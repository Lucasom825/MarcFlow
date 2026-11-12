"use client";

import {useEffect,useState} from "react";
import {ExternalLink,ShieldCheck,AlertTriangle} from "lucide-react";

type ValidatedRunReport={
  target:{repository:string;commit:string;directory:string};
  status:"INCONCLUSIVO"|"COBERTURA_ESTRUTURAL_COM_RESSALVAS"|"COBERTURA_ESTRUTURAL_CONFIRMADA";
  run_id:number;artifact_id:number;created_at:string;evidence_id:string;report_sha256:string;
  structural_hubs:{module:string;direct_dependents:number}[];
  uncertainties:string[];
  checks:{
    ast_js_files:number;rea_parsed_js:number;matched_import_sites:number;ast_import_sites:number;
    ast_unique_internal_import_pairs:number;additional_rea_unreconciled:number;
    rea_semantic_unknowns:number;
  };
  source_executed:false;behavior_test_verified:false;
};
type RunState={
  run_id:number;state:"queued"|"in_progress"|"result_pending"|"failed"|"completed";
  conclusion:string|null;url:string;report:ValidatedRunReport|null;
};
const LABELS:Record<RunState["state"],string>={
  queued:"Na fila",in_progress:"Análise em andamento",
  result_pending:"Relatório em publicação",failed:"Falha na execução",
  completed:"Relatório verificado"
};

/**
 * Read-only, run-specific renderer. The server verifies GitHub provenance and
 * the bounded public summary before this component renders any REA conclusions.
 */
export function Rea072RunPanel({runId}:{runId:number}){
  const [state,setState]=useState<RunState|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!Number.isSafeInteger(runId)||runId<1)return;
    let active=true;
    let timer:ReturnType<typeof setTimeout>|undefined;
    setState(null);setError("");
    async function poll(){
      if(!active)return;
      let shouldRetry=true;
      try{
        const response=await fetch("/api/nexus/rea/jobs/"+runId,{
          method:"GET",credentials:"same-origin",cache:"no-store"
        });
        const body=await response.json();
        if(!response.ok)throw new Error(body.error||"Falha na consulta da execução.");
        if(active){
          const result=body as RunState;
          setState(result);setError("");
          shouldRetry=["queued","in_progress","result_pending"].includes(result.state);
        }
      }catch(e){
        if(active)setError(e instanceof Error?e.message:"Falha ao consultar o GitHub.");
      }finally{
        if(active&&shouldRetry)timer=setTimeout(()=>{void poll();},16000);
      }
    }
    void poll();
    return ()=>{active=false;if(timer)clearTimeout(timer);};
  },[runId]);
  if(!Number.isSafeInteger(runId)||runId<1)return null;
  const report=state?.state==="completed"?state.report:null;
  const summaryUrl="https://github.com/Lucasom825/rea/blob/nexus/rea-public-jobs-070-20261111/nexus-pilot/public-reports/by-run/"+runId+".json";
  return <section className="space-y-3 rounded-xl border bg-card p-4 text-sm" aria-label="Resultado REA por execução">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">NEXUS 072 — Execução REA #{runId}</h3>
      <span role="status" className="rounded-full bg-muted px-3 py-1">
        {state?LABELS[state.state]:"Consultando GitHub"}
      </span>
    </div>
    {error&&<p role="alert" className="text-amber-900">{error}</p>}
    {state?.url&&<a className="inline-flex items-center gap-1 font-medium text-emerald-800 underline"
      href={state.url} target="_blank" rel="noreferrer">
      Ver execução e logs no GitHub <ExternalLink className="h-4 w-4"/>
    </a>}
    {state?.state==="failed"&&<p className="flex gap-2 text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0"/>
      A análise falhou. Nenhum relatório é considerado validado.
    </p>}
    {state?.state==="result_pending"&&<p className="text-muted-foreground">
      A execução terminou, mas a publicação por execução ainda está sendo confirmada.
    </p>}
    {report&&<div className="space-y-3">
      <p className="flex gap-2 font-semibold text-emerald-800">
        <ShieldCheck className="h-4 w-4 shrink-0"/>
        Relatório estático verificado: {report.status.replaceAll("_"," ")}
      </p>
      <p>Projeto: <strong>{report.target.repository}</strong> — pasta <code>{report.target.directory}</code></p>
      <p className="break-all text-xs text-muted-foreground">Commit analisado: {report.target.commit}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg bg-muted/60 p-2">JavaScript <strong>{report.checks.rea_parsed_js}/{report.checks.ast_js_files}</strong></div>
        <div className="rounded-lg bg-muted/60 p-2">Importações <strong>{report.checks.matched_import_sites}/{report.checks.ast_import_sites}</strong></div>
        <div className="rounded-lg bg-muted/60 p-2">Dependências internas <strong>{report.checks.ast_unique_internal_import_pairs}</strong></div>
        <div className="rounded-lg bg-muted/60 p-2">Ocorrências incertas <strong>{report.checks.additional_rea_unreconciled}</strong></div>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold">Mapa estrutural — módulos mais importados</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left">
            <thead className="bg-muted/60"><tr><th className="p-2">Arquivo</th><th className="p-2">Dependentes diretos</th></tr></thead>
            <tbody>{report.structural_hubs.map(h=><tr key={h.module} className="border-t">
              <td className="break-all p-2 font-mono text-xs">{h.module}</td>
              <td className="p-2">{h.direct_dependents}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Número de importações não determina qual funcionalidade é mais importante. As relações são estruturais, não testes de comportamento.
        </p>
      </div>
      <p className="text-amber-900">
        <strong>Limitação:</strong> {report.checks.rea_semantic_unknowns.toLocaleString("pt-BR")} ocorrências semânticas não resolvidas.
        Nenhum código externo foi executado e nenhum aplicativo foi reconstruído.
      </p>
      {report.uncertainties.length>0&&<p className="text-amber-900">
        <strong>Ressalvas registradas:</strong> {report.uncertainties.join("; ")}
      </p>}
      <div className="rounded-lg border p-2 text-xs text-muted-foreground">
        <p className="break-all">Evidence ID: {report.evidence_id}</p>
        <p className="break-all">SHA-256 do relatório: {report.report_sha256}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <a href={summaryUrl} target="_blank" rel="noreferrer" className="text-emerald-800 underline">Resumo JSON publicado</a>
        <a href={"https://github.com/Lucasom825/rea/actions/runs/"+runId+"/artifacts/"+report.artifact_id} target="_blank" rel="noreferrer"
          className="text-emerald-800 underline">Evidência original da análise</a>
      </div>
    </div>}
    <p className="text-xs text-muted-foreground">
      O NEXUS consulta somente esta execução até a conclusão; sem nova análise ou publicação automática.
    </p>
  </section>;
}
