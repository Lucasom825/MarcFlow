"use client";

import {useCallback,useEffect,useState} from "react";
import {AlertTriangle,CheckCircle2,ExternalLink,FileSearch,ShieldCheck} from "lucide-react";
import {
  buildReaReuseDossier,formatReaReuseDossier,REA_REUSE_PROJECTS,
  type ReaReuseProject,type Rea073Report
} from "@/lib/nexus-rea-reuse-073";

type RunResult={
  run_id:number;
  state:"queued"|"in_progress"|"result_pending"|"completed"|"failed";
  conclusion:string|null;
  url:string;
  report:Rea073Report|null;
};

export function Rea073ReusePanel({runId}:{runId:number|null}){
  const [result,setResult]=useState<RunResult|null>(null);
  const [phase,setPhase]=useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [project,setProject]=useState<ReaReuseProject>("NEXUS");
  const [selected,setSelected]=useState("");
  const [objective,setObjective]=useState("");
  const [copyState,setCopyState]=useState("");

  const reload=useCallback(()=>{setPhase("loading");setRefresh(v=>v+1);},[]);
  useEffect(()=>{
    if(!runId || !Number.isSafeInteger(runId))return;
    const abort=new AbortController();
    let active=true;
    setPhase("loading");setError("");setResult(null);setSelected("");setCopyState("");
    fetch("/api/nexus/rea/jobs/"+runId,{
      method:"GET",credentials:"same-origin",cache:"no-store",signal:abort.signal
    }).then(async response=>{
      const value=await response.json();
      if(!response.ok)throw new Error(value.error||"Não foi possível consultar o relatório.");
      if(active){
        const run=value as RunResult;
        if(run.run_id!==runId)throw new Error("ID de execução não confere.");
        setResult(run);
        setPhase("ready");
        if(run.state==="completed"&&run.report?.structural_hubs.length){
          setSelected(run.report.structural_hubs[0].module);
        }
      }
    }).catch(e=>{
      if(active){setPhase("error");setError(e instanceof Error?e.message:"Falha de consulta.");}
    });
    return ()=>{active=false;abort.abort();};
  },[runId,refresh]);

  if(!runId||!Number.isSafeInteger(runId)||runId<1){
    return <section className="rounded-xl border p-5" role="alert">
      Informe uma execução pública da REA pela URL, por exemplo: <code>?rea_run=43274412800</code>.
      Nenhuma análise será iniciada aqui.
    </section>;
  }

  const report=result?.state==="completed"?result.report:null;
  const dossier=report?buildReaReuseDossier(report,project,selected):null;
  async function copyDossier(){
    if(!report||!dossier)return;
    try{
      await navigator.clipboard.writeText(formatReaReuseDossier(report,project,selected,objective));
      setCopyState("Dossiê copiado, sem gravação no servidor.");
    }catch{
      setCopyState("Não foi possível copiar. Verifique a permissão de transferência.");
    }
  }

  return <section className="space-y-5 rounded-2xl border bg-card p-5" aria-label="NEXUS 073 — mapa de aproveitamento">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <FileSearch className="h-4 w-4"/> NEXUS 073 — TRIAGEM DE APROVEITAMENTO
        </div>
        <h2 className="mt-2 text-xl font-semibold">Da evidência ao candidato de funcionalidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados verificados pelo GitHub Actions; hipóteses e decisões permanecem pendentes de revisão.
        </p>
      </div>
      <button type="button" onClick={reload}
        className="rounded-lg border px-3 py-2 text-sm">Atualizar leitura</button>
    </div>
    {phase==="loading"&&<p role="status" className="text-sm">Consultando execução verificada #{runId}...</p>}
    {phase==="error"&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {phase==="ready"&&result?.state!=="completed"&&<p role="status" className="text-sm text-amber-900">
      Execução #{runId}: {result?.state==="failed"?"análise falhou":
        result?.state==="result_pending"?"relatório ainda não publicado":
        "análise não concluída"}. Nenhum aproveitamento é considerado validado.
    </p>}
    {phase==="ready"&&result?.state==="completed"&&!report&&<p role="alert">
      Resumo validado indisponível. O NEXUS não inventará candidatos.
    </p>}
    {report&&<>
      <div className="space-y-2 rounded-lg border p-3">
        <p className="flex items-center gap-2 font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4"/> Evidência estrutural confirmada para consulta
        </p>
        <p className="text-sm">Projeto <strong>{report.target.repository}</strong>, pasta <code>{report.target.directory}</code>, execução #{report.run_id}</p>
        <p className="break-all text-xs text-muted-foreground">SHA fixado da origem: {report.target.commit}</p>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-muted/60 p-2">Arquivos JS <strong>{report.checks.rea_parsed_js}/{report.checks.ast_js_files}</strong></div>
          <div className="rounded-lg bg-muted/60 p-2">Importações <strong>{report.checks.matched_import_sites}/{report.checks.ast_import_sites}</strong></div>
          <div className="rounded-lg bg-muted/60 p-2">Referências incertas <strong>{report.checks.additional_rea_unreconciled}</strong></div>
          <div className="rounded-lg bg-muted/60 p-2">Incógnitas semânticas <strong>{report.checks.rea_semantic_unknowns.toLocaleString("pt-BR")}</strong></div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="rea073-project">Projeto que poderia receber a funcionalidade</label>
          <select id="rea073-project" className="w-full rounded-lg border bg-background p-3 text-sm"
            value={project} onChange={e=>{setProject(e.target.value as ReaReuseProject);setCopyState("");}}>
            {REA_REUSE_PROJECTS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="rea073-module">Arquivo candidato à investigação</label>
          <select id="rea073-module" className="w-full rounded-lg border bg-background p-3 text-sm"
            value={selected} onChange={e=>{setSelected(e.target.value);setCopyState("");}}>
            {report.structural_hubs.map(h=><option key={h.module} value={h.module}>
              {h.module} ({h.direct_dependents} dependentes)
            </option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="rea073-objective">Qual problema concreto queremos resolver?</label>
        <textarea id="rea073-objective" maxLength={400} rows={3} value={objective}
          onChange={e=>{setObjective(e.target.value);setCopyState("");}}
          placeholder="Ex.: reduzir retrabalho em determinada etapa do NEXUS; hipótese a validar."
          className="w-full rounded-lg border bg-background p-3 text-sm"/>
        <p className="text-xs text-muted-foreground">Este texto permanece apenas na página até ser copiado; não é salvo no servidor.</p>
      </div>
      {!dossier&&<p className="text-sm text-amber-900">
        Nenhum módulo estrutural disponível para triagem. Isso não significa ausência de funcionalidades.
      </p>}
      {dossier&&<div className="space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Dossiê preliminar — {dossier.module}</h3>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
            NÃO APROVADO PARA REUTILIZAÇÃO
          </span>
        </div>
        <p className="text-sm"><strong>Contexto escolhido:</strong> {dossier.projectInterest}.
          Isso é uma área de interesse, não uma compatibilidade demonstrada.</p>
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4"/> Fatos extraídos do relatório
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {dossier.observed.map(v=><li key={v}>{v}</li>)}
          </ul>
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Hipótese inicial — não comprovada</h4>
          <p className="text-sm">{dossier.hypothesis}</p>
          {dossier.sourceUrl&&<a target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-emerald-800 underline"
            href={dossier.sourceUrl}>Inspecionar arquivo no commit fixado <ExternalLink className="h-4 w-4"/></a>}
        </div>
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4"/> Riscos e verificações pendentes
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {dossier.limitations.map(v=><li key={v}>{v}</li>)}
            {dossier.pending.map(v=><li key={v}>{v}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border p-3 text-xs text-muted-foreground">
          <p className="break-all">Evidence ID: {report.evidence_id}</p>
          <p className="break-all">SHA-256 do relatório: {report.report_sha256}</p>
        </div>
        <button type="button" onClick={()=>void copyDossier()}
          className="rounded-lg border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900">
          Copiar dossiê de investigação
        </button>
        {copyState&&<p role="status" className="text-xs">{copyState}</p>}
      </div>}
      <p className="text-xs text-muted-foreground">
        O NEXUS não realizou instalações, cópia de código, testes de comportamento, alterações de banco ou integração produtiva.
        Uma pontuação de dependências não é uma avaliação de valor de negócio.
      </p>
    </>}
  </section>;
}
