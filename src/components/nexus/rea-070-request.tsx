"use client";

import {useEffect,useState} from "react";
import {AlertTriangle,ExternalLink,ShieldCheck} from "lucide-react";
import {Rea072RunPanel} from "@/components/nexus/rea-run-072";

type Target={repository:string;pinned_sha:string;license_allowlisted_for_toolkit:boolean;javascript_files:number};

export function Rea070Request({target,scope}:{target:Target;scope:string}){
  const [ready,setReady]=useState(false);
  const [canonicalDemoUrl,setCanonicalDemoUrl]=useState("");
  const [configLoading,setConfigLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [credentialStatus,setCredentialStatus]=useState("");
  const [checkingCredential,setCheckingCredential]=useState(false);
  const [credentialError,setCredentialError]=useState("");
  const [runId,setRunId]=useState<number|null>(null);
  const [workflowUrl,setWorkflowUrl]=useState("");

  useEffect(()=>{
    let active=true;
    fetch("/api/nexus/rea/config",{cache:"no-store",credentials:"same-origin"})
      .then(async r=>r.ok?await r.json():{configured:false})
      .then(data=>{if(active){
        setReady(data.configured===true);
        setCanonicalDemoUrl(typeof data.canonical_demo_url==="string" ? data.canonical_demo_url : "");
        setConfigLoading(false);
      }})
      .catch(()=>{if(active){setReady(false);setConfigLoading(false);}});
    const match=new URLSearchParams(window.location.search).get("rea_run");
    if(match && /^[1-9][0-9]{0,15}$/.test(match) && Number.isSafeInteger(Number(match)))
      setRunId(Number(match));
    return ()=>{active=false;};
  },[]);

  const allowed=target.license_allowlisted_for_toolkit&&target.javascript_files>0&&Boolean(scope);
  // Read-only navigation hint. No change to the strict server-side Origin check.
  const expectedOrigin=canonicalDemoUrl ? (()=>{try{return new URL(canonicalDemoUrl).origin;}catch{return "";}})() : "";
  const wrongBrowserOrigin=Boolean(expectedOrigin &&
    typeof window!=="undefined" && window.location.origin!==expectedOrigin);
  async function submit(){
    if(!ready||!allowed||working||wrongBrowserOrigin)return;
    setWorking(true);setError("");
    try{
      // Refresh the signed, time-limited proof immediately before each request.
      // The secret itself is never exposed to the browser, only this proof.
      const cfgResponse=await fetch("/api/nexus/rea/config",{
        cache:"no-store",credentials:"same-origin"
      });
      if(!cfgResponse.ok)throw new Error("Não foi possível verificar a sessão REA.");
      const cfg=await cfgResponse.json();
      const proof=typeof cfg.dispatch_proof==="string" ? cfg.dispatch_proof : "";
      if(cfg.configured!==true || !proof)
        throw new Error("Proteção de solicitação indisponível; confira a sessão e a configuração.");
      const response=await fetch("/api/nexus/rea/request",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json","X-NEXUS-REA-Proof":proof},
        body:JSON.stringify({repository:target.repository,commit:target.pinned_sha,directory:scope})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(
        (data.error||"Não foi possível criar o job.")+
        (typeof data.code==="string" ? " [Código: "+data.code+"]" : "")+
        (typeof data.origin_code==="string" ? " [Origem: "+data.origin_code+"]" : "")+
        (data.diagnostic_version==="NEXUS071_CSRF_4" ?
          " [Proteção 071.4]" : data.diagnostic_version==="NEXUS071_ORIGIN_DIAG_2" ?
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
  async function diagnoseCredential(){
    if(checkingCredential)return;
    setCheckingCredential(true);setCredentialError("");setCredentialStatus("");
    try{
      const response=await fetch("/api/nexus/rea/config?diagnose=1",{
        cache:"no-store",credentials:"same-origin"
      });
      if(!response.ok)throw new Error("Sessão inválida ou diagnóstico indisponível.");
      const data=await response.json();
      const status=typeof data.credential_check?.status==="string"?
        data.credential_check.status:"UNAVAILABLE";
      const messages:Record<string,string>={
        TOKEN_MISSING:"O token não está montado no servidor.",
        TOKEN_AUTHENTICATED:"GitHub reconheceu o token como pertencente à conta esperada. Isso NÃO comprova Actions:write nem acesso ao fork REA.",
        TOKEN_OTHER_ACCOUNT:"GitHub reconheceu a credencial, mas ela pertence a outra conta. Confirme se essa conta tem acesso autorizado ao fork REA.",
        TOKEN_REJECTED:"GitHub rejeitou o token (401): ele pode ter expirado, sido revogado ou substituído no GitHub.",
        GITHUB_FORBIDDEN:"GitHub bloqueou até a consulta de identidade. Confira políticas de acesso e permissões.",
        RATE_LIMITED:"Limite de API atingido; não repita solicitações até a liberação.",
        UNAVAILABLE:"Não foi possível concluir o diagnóstico de identidade. Nenhuma análise foi solicitada."
      };
      setCredentialStatus(messages[status]||messages.UNAVAILABLE);
    }catch(e){setCredentialError(e instanceof Error?e.message:"Diagnóstico indisponível");}
    finally{setCheckingCredential(false);}
  }
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
      <p className="text-xs text-emerald-800">Segredo do GitHub detectado no servidor; autorização Actions:write ainda não confirmada.</p>}
    {wrongBrowserOrigin&&<div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p><strong>Endereço de acesso diferente do configurado.</strong> Você abriu o NEXUS por outro endereço. Por segurança, a solicitação REA está bloqueada.</p>
      <a href={canonicalDemoUrl} className="inline-flex items-center gap-1 font-semibold underline">
        Abrir o NEXUS pelo endereço correto <ExternalLink className="h-4 w-4"/>
      </a>
      <p className="text-xs">Se o login for solicitado novamente, use a conta de demonstração já configurada. Não compartilhe senhas.</p>
    </div>}
    <button type="button" onClick={()=>void submit()} disabled={!ready||!allowed||working||wrongBrowserOrigin}
      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
      {working?"Solicitando...":"Solicitar análise estática"}
    </button>
    {error&&<p role="alert" className="text-sm text-amber-800">{error}</p>}
    {ready&&<div className="space-y-2 border-t border-emerald-200 pt-3 text-sm">
      <button type="button" disabled={checkingCredential} onClick={()=>void diagnoseCredential()}
        className="rounded-lg border border-emerald-700 px-3 py-2 text-emerald-900 disabled:opacity-50">
        {checkingCredential?"Verificando...":"Verificar credencial (sem iniciar análise)"}
      </button>
      {credentialStatus&&<p role="status" className="text-amber-900">{credentialStatus}</p>}
      {credentialError&&<p role="alert" className="text-amber-900">{credentialError}</p>}
      <p className="text-xs text-muted-foreground">Esta consulta de leitura nunca executa a REA, não mostra o token e não comprova permissão de escrita no GitHub.</p>
    </div>}
    {workflowUrl&&<a href={workflowUrl} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-emerald-800 underline">Consultar workflow no GitHub <ExternalLink className="h-4 w-4"/></a>}
    {runId&&<Rea072RunPanel runId={runId}/>}
  </section>;
}
