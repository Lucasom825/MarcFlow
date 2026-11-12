"use client";

import Link from "next/link";
import {ReaFunctionalLab074} from "@/components/nexus/rea-functional-lab-074";

export default function ReaFunctionalLabPage(){
  return <main className="mx-auto max-w-5xl space-y-5 pb-14">
    <nav className="text-sm">
      <Link className="text-emerald-800 underline" href="/dashboard/nexus/rea/reuse?rea_run=43274412800">
        Voltar ao mapa de investigação NEXUS 073
      </Link>
    </nav>
    <ReaFunctionalLab074/>
    <section className="rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">Próxima etapa: contrato de tarefas NEXUS 075</h2>
      <p className="my-2 text-muted-foreground">Conferir duplicidades e conflitos com dados fictícios,
      antes de qualquer conexão com o Memora real.</p>
      <Link href="/dashboard/nexus/rea/memora-contract" className="font-semibold text-emerald-800 underline">
        Abrir simulação do contrato de tarefas
      </Link>
    </section>
  </main>;
}
