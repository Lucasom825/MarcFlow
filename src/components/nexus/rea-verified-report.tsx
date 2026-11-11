"use client";

import {useEffect,useState} from "react";
import {ExternalLink,RefreshCw,ShieldCheck,AlertCircle,FileSearch} from "lucide-react";
import Link from "next/link";
import type {PublicReaReport} from "@/lib/nexus-rea-public-report";

type ReadState={phase:"loading"|"error"|"ready";error?:string;report?:PublicReaReport};
export function ReaVerifiedReport({detailed=false}:{detailed?:boolean}){
  const [state,setState]=useState<ReadState>({phase:"loading"});
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    let current=true;
    fetch("/api/nexus/rea/report",{credentials:"same-origin",cache:"no-store",signal:controller.signal})
      .then(async r=>{
        const body=await r.json();
        if(!r.ok)throw Error(body.error||"Não foi possível validar a análise.");
        if(current)setState({phase:"ready",report:body as PublicReaReport});
      })
      .catch(e=>{if(current)setState({phase:"error",error:e instanceof Error?e.message:"Erro desconhecido"});});
    return ()=>{current=false;controller.abort();};
  },[tick]);
  const r=state.report;
  const refresh=()=>{setState({phase:"loading"});setTick(t=>t+1);};
  const metrics=r?[ 
    ["Arquivos JavaScript",r.checks.rea_parsed_js+"/"+r.checks.ast_js_files],
    ["Importações verificadas",r.checks.matched_import_sites+"/"+r.checks.ast_import_sites],
    ["Dependências internas",r.checks.ast_unique_internal_import_pairs.toLocaleString("pt-BR")],
    ["Ocorrências inconclusivas",r.checks.additional_rea_unreconciled.toLocaleString("pt-BR")],
  ]:[];
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4" aria-label="Relatório real da REA">
      <div className="flex flex-wrap gap-2 items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wide">
            <ShieldCheck className="h-4 w-4"/> Proveniência conferida pelo GitHub Actions
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Relatório real REA: Axios / lib</h2>
          <p className="text-sm text-muted-foreground">
            Resultado publicado automaticamente pela REA; leitura apenas, sem instalar código de terceiros.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={state.phase==="loading"}
          className="rounded-lg border px-3 py-2 text-xs inline-flex gap-2 items-center disabled:opacity-50">
          <RefreshCw className="h-4 w-4"/> Atualizar
        </button>
      </div>
      {state.phase==="loading"&&<p role="status" className="text-sm text-muted-foreground">Consultando publicação e execução GitHub...</p>}
      {state.phase==="error"&&<div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0"/>
        <div><strong>Relatório ainda não confirmado:</strong> {state.error}.
          O NEXUS não exibirá dados de uma execução não validada.</div>
      </div>}
      {r&&state.phase==="ready"&&<>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-900">
            {r.status==="COBERTURA_ESTRUTURAL_COM_RESSALVAS"?
              "Cobertura estrutural com ressalvas":
              r.status==="COBERTURA_ESTRUTURAL_CONFIRMADA"?
              "Cobertura estrutural confirmada":"Inconclusivo"}
          </span>
          <span className="text-xs text-muted-foreground">
            Resultado emitido: {new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(new Date(r.created_at))} (Brasília)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(([label,value])=>
            <div key={label} className="rounded-xl bg-muted/60 p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-xl font-bold">{value}</div>
            </div>
          )}
        </div>
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p><strong>Projeto:</strong> {r.target.repository} — pasta <code>{r.target.directory}</code></p>
          <p className="break-all text-xs text-muted-foreground"><strong>Commit da origem:</strong> {r.target.commit}</p>
          <p className="break-all text-xs text-muted-foreground"><strong>Evidence ID:</strong> {r.evidence_id}</p>
          <p><strong>Validação:</strong> GitHub Actions #{r.run_id} concluído com sucesso; publicação pública vinculada ao mesmo run.</p>
        </div>
        {detailed&&<>
          <h3 className="text-sm font-semibold">Módulos mais importados no escopo</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60"><tr><th className="p-3">Módulo</th><th className="p-3">Dependentes diretos</th></tr></thead>
              <tbody>{r.structural_hubs.map(h=><tr key={h.module} className="border-t">
                <td className="p-3 font-mono text-xs">{h.module}</td>
                <td className="p-3">{h.direct_dependents}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="text-sm"><strong>Incógnitas semânticas identificadas:</strong> {r.checks.rea_semantic_unknowns.toLocaleString("pt-BR")}. A presença de incógnitas impede afirmar compreensão funcional completa.</p>
          <p className="break-all text-xs text-muted-foreground"><strong>SHA-256 do JSON original:</strong> {r.report_sha256}</p>
          {r.uncertainties.length>0&&<p className="text-sm text-amber-900"><strong>Ressalvas:</strong> {r.uncertainties.join("; ")}</p>}
        </>}
        <div className="flex flex-wrap gap-4 text-sm">
          <a className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline" href={r.run_url} target="_blank" rel="noreferrer">
            Ver execução no GitHub <ExternalLink className="h-4 w-4"/>
          </a>
          <a className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline"
            href={r.run_url+"/artifacts/"+r.artifact_id} target="_blank" rel="noreferrer">
            Evidências originais <ExternalLink className="h-4 w-4"/>
          </a>
          {!detailed&&<Link className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline" href="/dashboard/nexus/rea/results">
            <FileSearch className="h-4 w-4"/> Ver relatório detalhado
          </Link>}
        </div>
      </>}
      <p className="text-xs text-muted-foreground">
        Verificações estruturais não comprovam funcionamento, equivalência funcional ou segurança do projeto. Não há construção automática de aplicativos nesta versão.
      </p>
    </section>
  );
}
