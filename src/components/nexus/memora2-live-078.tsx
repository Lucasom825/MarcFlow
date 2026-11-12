"use client";

import {useState} from "react";
import {type Memora2ReadinessResult076,summarizeMemora2Readiness076}
  from "@/lib/nexus-memora2-readiness-076";

export function NexusMemora2Live078(){
  const [result,setResult]=useState<Memora2ReadinessResult076|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  async function load(){
    setResult(null);setError("");setLoading(true);
    try{
      const response=await fetch("/api/nexus/memora2/readiness",{
        method:"GET",credentials:"same-origin",cache:"no-store",
      });
      const body=await response.json();
      if(!response.ok)throw new Error("A leitura autenticada não está disponível.");
      setResult(body as Memora2ReadinessResult076);
    }catch(e){
      setError(e instanceof Error?e.message:"Falha na consulta.");
    }finally{setLoading(false);}
  }
  const counts=result?summarizeMemora2Readiness076(result):null;
  return <section className="mx-auto max-w-5xl space-y-4 rounded-xl border bg-card p-5">
    <h1 className="text-xl font-bold">NEXUS 078 — Consulta autenticada do Memora 2</h1>
    <p className="text-sm text-muted-foreground">
      Consulta iniciada manualmente, restrita ao usuário autorizado. Exibe somente
      referências opacas e estados de reuniões recentes. Nenhum nome, áudio, transcrição,
      ata ou diagnóstico interno será exibido.
    </p>
    <button type="button" disabled={loading} onClick={()=>void load()}
      className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
      {loading?"Consultando...":"Consultar estados recentes (somente leitura)"}
    </button>
    {error&&<p role="alert" className="text-sm text-amber-900">{error}</p>}
    {result&&<>
      <p className="text-sm">Consulta concluída. Isto não certifica qualidade das atas nem representa o histórico inteiro.</p>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded border p-3">PDF registrado: <strong>{counts?.pdf_present}</strong></div>
        <div className="rounded border p-3">Em processamento: <strong>{counts?.in_progress}</strong></div>
        <div className="rounded border p-3">Concluído sem PDF: <strong>{counts?.processed_without_pdf}</strong></div>
        <div className="rounded border p-3">Erros: <strong>{counts?.review}</strong></div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead><tr className="bg-muted/60">
            <th className="p-2">Referência opaca</th><th className="p-2">Origem</th>
            <th className="p-2">Estado</th><th className="p-2">PDF registrado</th>
          </tr></thead>
          <tbody>{result.items.map(row=><tr key={row.reference} className="border-t">
            <td className="p-2 font-mono text-xs">{row.reference}</td>
            <td className="p-2">{row.source}</td>
            <td className="p-2">{row.status}</td>
            <td className="p-2">{row.hasSavedPdf?"Sim — não validado":"Não"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Escritas: {result.writes_performed}. Áudio, transcrição e qualidade da ata:
        não verificados. O resultado permanece apenas nesta página.
      </p>
    </>}
  </section>;
}
