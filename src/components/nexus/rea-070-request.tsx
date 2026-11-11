"use client";

import {useEffect,useState} from "react";
import {AlertTriangle,ExternalLink,ShieldCheck} from "lucide-react";

type Target={repository:string;pinned_sha:string;license_allowlisted_for_toolkit:boolean;javascript_files:number};
type State={run_id:number;state:"queued"|"in_progress"|"completed"|"result_pending"|"failed";conclusion:string|null;url:string;report:null|Record<string,unknown>};

export function Rea070Request({target,scope}:{target:Target;scope:string}){
  const [ready,setReady]=useState(false);
  const [configLoading,setConfigLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [runId,setRunId]=useState<number|null>(null);
  const [workflowUrl,setWorkflowUrl]=useState("");
  const [state,setState]=useState<State|null>(null);

  useEffect(()=>{
    let active=true;
    fetch("/api/nexus/rea/config",{cache:"no-store",credentials:"same-origin"})
      .then(async r=>r.ok?await r.json():{configured:false})
      .then(data=>{if(active){setReady(data.configured===true);setConfigLoading(false);}})
      .catch(()=>{if(active){setReady(false);setConfigLoading(false);}});
    const match=new URLSearchParams(window.location.search).get("rea_run");
    if(match && /^[1-9][0-9]{0,15}$/.test(match) && Number.isSafeInteger(Number(match)))
      setRunId(Number(match));
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(!runId)return;
    let active=true;
    let inFlight=false;
    async function poll(){
      if(inFlight)return;
      inFlight=true;
      try{
        const response=await fetch("/api/nexus/rea/jobs/"+runId,{cache:"no-store",credentials:"same-origin"});
        const json=await response.json();
        if(!response.ok)throw new Error(json.error||"Não foi possível verificar a execução.");
        if(active){setState(json as State);setError("");}
      }catch(e){if(active)setError(e instanceof Error?e.message:"Erro ao consultar a REA");}
      finally{inFlight=false;}
    }
    void poll();
    const timer=setInterval(()=>{void poll();},16000);
    return ()=>{active=false;clearInterval(timer);};
  },[runId]);

  const allowed=target.license_allowlisted_for_toolkit&&target.javascript_files>0&&Boolean(scope);
  async function submit(){
    if(!ready||!allowed||working)return;
    setWorking(true);setError("");setState(null);
    try{
      const response=await fetch("/api/nexus/rea/request",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({repository:target.repository,commit:target.pinned_sha,directory:scope})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(
        (data.error||"Não foi possível criar o job.")+
        (typeof data.code==="string" ? " [Código: "+data.code+"]" : "")+
        (data.diagnostic_version==="NEXUS071_ORIGIN_DIAG_2" ?
          " [Diagnóstico 071.2]" : data.diagnostic_version==="NEXUS071_ORIGIN_DIAG_1" ?
          " [Diagnóstico 071.1]" : "")
      );
      if(data.run_id && Number.isSafeInteger(data.run_id)){
        setRunId(data.run_id);
        const url=new URL(window.location.href);
        url.searchParams.set("rea_run",String(data.run_id));
        window.history.replaceState(null,"",url.pathname+url.search+url.hash);
      }else{
        setWorkflowUrl(data.workflow_url||"");
        setError("Solicitação recebida pelo GitHub, mas a API não retornou o número da execução. Confira a página do workflow antes de solicitar novamente.");
      }
    }catch(e){setError(e instanceof Error?e.message:"Falha no pedido");}
    finally{setWorking(false);}
  }
  const report=state?.report;
  const checks=report?.checks as Record<string,number>|undefined;
  const source=report?.target as Record<string,string>|undefined;
  return <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
    <div className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-700"/> NEXUS 071 — Solicitar análise REA</div>
    <p className="text-sm text-muted-foreground">
      Envia ao workflow REA apenas o repositório público, commit fixado e pasta validada.
      Não instala ou executa código externo no NEXUS.
    </p>
    <p className="text-sm"><strong>Alvo:</strong> {target.repository} @ {target.pinned_sha.slice(0,12)} / {scope||"selecione uma pasta"}</p>
    {configLoading?<p role="status" className="text-sm">Verificando autorização...</p>:
      !ready?<div role="status" className="flex gap-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0"/>
        <span>A integração de envio ainda não foi autorizada no servidor. A pré-análise e os relatórios existentes continuam funcionando. A permissão necessária é GitHub Actions:write restrita ao repositório REA, armazenada exclusivamente como segredo do Codespaces.</span>
      </div>:
      <p className="text-xs text-emerald-800">Conector GitHub Actions configurado no servidor.</p>}
    <button type="button" onClick={()=>void submit()} disabled={!ready||!allowed||working}
      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
      {working?"Solicitando...":"Solicitar análise estática"}
    </button>
    {error&&<p role="alert" className="text-sm text-amber-800">{error}</p>}
    {workflowUrl&&<a href={workflowUrl} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-emerald-800 underline">Consultar workflow no GitHub <ExternalLink className="h-4 w-4"/></a>}
    {runId&&<div className="rounded-lg border bg-card p-3 space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <strong>Execução #{runId}</strong>
        {state?<span className="rounded-full bg-muted px-2 py-1">{state.state==="completed"?"Relatório recebido":state.state==="failed"?"Falha no workflow":state.state==="result_pending"?"Publicação do relatório em andamento":state.state==="queued"?"Na fila":"Em execução"}</span>:<span>Consultando...</span>}
      </div>
      {state?.url&&<a href={state.url} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-emerald-700 underline">Ver progresso e logs no GitHub <ExternalLink className="h-4 w-4"/></a>}
      {state?.state==="failed"&&<p className="text-amber-900">A execução não terminou com sucesso. Não há relatório validado.</p>}
      {state?.state==="completed"&&report&&checks&&<div className="space-y-2">
        <p className="font-semibold">Resultado publicado da REA: {String(report.status).replaceAll("_"," ")}</p>
        <p>Projeto {source?.repository} / {source?.directory} — commit {source?.commit?.slice(0,12)}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/60 p-2">JS analisados: <strong>{checks.rea_parsed_js}/{checks.ast_js_files}</strong></div>
          <div className="rounded-md bg-muted/60 p-2">Importações: <strong>{checks.matched_import_sites}/{checks.ast_import_sites}</strong></div>
          <div className="rounded-md bg-muted/60 p-2">Dependências internas: <strong>{checks.ast_unique_internal_import_pairs}</strong></div>
          <div className="rounded-md bg-muted/60 p-2">Ocorrências incertas: <strong>{checks.additional_rea_unreconciled}</strong></div>
        </div>
        <p className="text-xs text-amber-800">Somente análise estática. Isso não comprova comportamento ou permite reconstrução automática do sistema.</p>
      </div>}
      <p className="text-xs text-muted-foreground">O andamento é consultado a cada 16 segundos enquanto esta página estiver aberta.</p>
    </div>}
  </section>;
}
