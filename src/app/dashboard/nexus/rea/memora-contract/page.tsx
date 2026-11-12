"use client";

import Link from "next/link";
import {NexusMemoraContract075} from "@/components/nexus/nexus-memora-contract-075";

export default function NexusMemoraContractPage(){
  return <main className="mx-auto max-w-5xl space-y-5 pb-14">
    <Link href="/dashboard/nexus/rea/lab"
      className="text-sm text-emerald-800 underline">Voltar ao laboratório NEXUS 074</Link>
    <NexusMemoraContract075/>
    <section className="rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">Próximo teste: formato verdadeiro do Memora 2</h2>
      <p className="my-2 text-muted-foreground">Simulação sem dados pessoais para avaliar estados
        de processamento de reuniões. Não é integração real.</p>
      <Link href="/dashboard/nexus/rea/memora2-readiness"
        className="font-semibold text-emerald-800 underline">Abrir NEXUS 076</Link>
    </section>
  </main>;
}
