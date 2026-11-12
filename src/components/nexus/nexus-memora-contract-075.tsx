"use client";

import {useMemo,useState} from "react";
import {GitCompareArrows,ShieldCheck,ClipboardCopy,AlertTriangle} from "lucide-react";
import {
  planMemoraTasks,sampleExisting075,sampleProposals075,summarizePlan075,
  type PlanStatus
} from "@/lib/nexus-memora-contract-075";

const labels:Record<PlanStatus,{label:string;className:string}>={
  SKIP_SAME:{label:"Já existe — ignorar",className:"text-slate-700"},
  REVIEW_CONFLICT:{label:"Conflito — revisão humana",className:"text-amber-900"},
  PROPOSE_CREATE:{label:"Candidata — sem autorização",className:"text-sky-900"},
  REJECT_INVALID:{label:"Entrada inválida",className:"text-red-700"},
};

export function NexusMemoraContract075(){
  const plan=useMemo(()=>planMemoraTasks(sampleProposals075,sampleExisting075),[]);
  const [copyState,setCopyState]=useState("");
  async function copy(){
    try{
      await navigator.clipboard.writeText(summarizePlan075(plan));
      setCopyState("Plano fictício copiado. Nenhuma tarefa foi enviada ou gravada.");
    }catch{
      setCopyState("Falha ao copiar; nenhuma tarefa foi enviada.");
    }
  }
  return <section className="space-y-5 rounded-2xl border bg-card p-5" aria-label="NEXUS 075 — Contrato de tarefas Memora">
    <header className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-bold text-emerald-800">
        <GitCompareArrows className="h-4 w-4"/> NEXUS 075 — DRY-RUN DE INTEROPERABILIDADE
      </p>
      <h1 className="text-xl font-semibold">Conferência de tarefas antes de integrar ao Memora</h1>
      <p className="text-sm text-muted-foreground">
        Simulação de comparação por reunião e descrição, sem conexão com dados reais.
        Não há sincronização, importação nem autorização de escrita.
      </p>
    </header>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4"/> Dados 100% fictícios — acesso ao Memora não configurado
      </div>
      <p className="mt-1">Os dados foram definidos no código de teste. Nenhuma conta Memora foi selecionada,
        nenhum dado privado foi consultado e nada foi criado ou atualizado.</p>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-lg">{plan.creates}</strong><p>Candidatas novas</p></div>
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-lg">{plan.skipped}</strong><p>Já existentes</p></div>
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-lg">{plan.conflicts}</strong><p>Conflitos</p></div>
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-lg">{plan.rejected}</strong><p>Entradas rejeitadas</p></div>
    </div>
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60">
          <tr><th className="p-3">Reunião fictícia</th><th className="p-3">Pendência</th><th className="p-3">Decisão simulada</th></tr>
        </thead>
        <tbody>{plan.actions.map((entry,index)=>(
          <tr key={index} className="border-t align-top">
            <td className="p-3 font-mono text-xs">{entry.source.meeting_id}</td>
            <td className="p-3">{entry.source.task}</td>
            <td className="p-3">
              <p className={"font-semibold "+labels[entry.status].className}>{labels[entry.status].label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    <p className="text-sm text-muted-foreground">
      A comparação exige ID da reunião e descrição igual após normalização de espaços e maiúsculas.
      Uma pendência com a mesma descrição em <strong>outra reunião</strong> não é considerada duplicata.
      Campos divergentes exigem revisão humana.
    </p>
    <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-emerald-800">
      <ShieldCheck className="h-5 w-5"/> <strong>Operações executadas no Memora: 0.</strong>
      Nenhum endpoint de escrita existe neste laboratório.
    </div>
    <div className="space-y-2">
      <button type="button" onClick={()=>void copy()}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900">
        <ClipboardCopy className="h-4 w-4"/> Copiar relatório da simulação
      </button>
      {copyState&&<p role="status" className="text-sm">{copyState}</p>}
      <p className="text-xs text-muted-foreground">
        Antes de qualquer integração real: escolher a conexão Memora correta,
        confirmar acesso somente leitura, validar o formato dos dados,
        testar conflitos e obter autorização específica para eventuais gravações.
      </p>
    </div>
  </section>;
}
