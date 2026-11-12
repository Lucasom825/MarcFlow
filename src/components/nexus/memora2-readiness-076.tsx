"use client";

import {useMemo} from "react";
import {ShieldCheck,AlertTriangle,FileSearch} from "lucide-react";
import {
  parseMemora2Recent076,syntheticMemora2Recent076,
  summarizeMemora2Readiness076,type MeetingReadiness076
} from "@/lib/nexus-memora2-readiness-076";

const statusLabels:Record<MeetingReadiness076,{text:string;tone:string}>={
  PDF_PRESENT_NOT_VALIDATED:{text:"PDF presente — qualidade não verificada",tone:"text-emerald-800"},
  PROCESSED_WITHOUT_PDF:{text:"Concluída — PDF não confirmado",tone:"text-amber-900"},
  IN_PROGRESS:{text:"Processamento em andamento",tone:"text-sky-900"},
  ERROR_REVIEW:{text:"Erro — investigar",tone:"text-rose-800"},
};

export function NexusMemora2Readiness076(){
  const report=useMemo(()=>parseMemora2Recent076(syntheticMemora2Recent076),[]);
  const counts=summarizeMemora2Readiness076(report);
  return <section className="space-y-5 rounded-2xl border bg-card p-5">
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
        <FileSearch className="h-4 w-4"/> NEXUS 076 — CONTRATO DO MEMORA 2
      </p>
      <h1 className="text-xl font-bold">Reuniões recentes — análise dos estados</h1>
      <p className="text-sm text-muted-foreground">
        Adaptador do formato de resumo de reuniões do Memora 2. Demonstração com dados fictícios.
        Sem conexão, áudio, transcrição, atas ou tarefas privadas.
      </p>
    </div>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4"/> Não conectado ao Memora 2
      </p>
      <p className="mt-1">
        Os registros abaixo são exemplos de teste, não reuniões suas. A consulta real exige sessão
        autorizada e revisão da origem. PDF presente não comprova fidelidade da ata.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-xl">{counts.pdf_present}</strong><p>PDF presente</p></div>
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-xl">{counts.in_progress}</strong><p>Em andamento</p></div>
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-xl">{counts.processed_without_pdf}</strong><p>Concluída sem PDF</p></div>
      <div className="rounded-lg bg-muted/60 p-3"><strong className="text-xl">{counts.review}</strong><p>Erro para investigar</p></div>
    </div>
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60"><tr>
          <th className="p-3">Reunião fictícia</th>
          <th className="p-3">Origem</th>
          <th className="p-3">Estado técnico</th>
          <th className="p-3">Interpretação limitada</th>
        </tr></thead>
        <tbody>{report.items.map(item=><tr key={item.reference} className="border-t">
          <td className="p-3 font-mono text-xs">{item.reference}</td>
          <td className="p-3">{item.source==="recorded"?"Gravada":"Importada"}</td>
          <td className="p-3 font-mono text-xs">{item.status}</td>
          <td className={"p-3 font-semibold "+statusLabels[item.readiness].tone}>
            {statusLabels[item.readiness].text}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="rounded-xl border p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-emerald-800">
        <ShieldCheck className="h-4 w-4"/> Proteções do teste
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1">
        <li>Campos como nome da reunião e mensagens internas de erro são descartados pelo adaptador.</li>
        <li>Não há chamadas de rede, credenciais, atualizações, exclusões ou processamento automático.</li>
        <li>A consulta de reuniões recentes do Memora 2 é limitada; não comprova inventário completo.</li>
        <li>Qualidade do áudio, transcrição e ata permanece não verificada.</li>
      </ul>
      <p className="mt-3 font-semibold">Operações de escrita realizadas: {report.writes_performed}</p>
    </div>
    <p className="text-xs text-muted-foreground">
      O endpoint de detalhe do Memora 2 pode acionar recuperação automática ao receber GET:
      ele não será tratado como leitura sem efeito colateral. Esta página não faz nenhuma requisição.
    </p>
  </section>;
}
