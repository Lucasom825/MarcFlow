"use client";

import Link from "next/link";
import {NexusMemora2Readiness076} from "@/components/nexus/memora2-readiness-076";

export default function Memora2ReadinessPage(){
  return <main className="mx-auto max-w-5xl space-y-5 pb-14">
    <nav className="text-sm">
      <Link href="/dashboard/nexus/rea/memora-contract"
        className="text-emerald-800 underline">Voltar ao contrato de tarefas NEXUS 075</Link>
    </nav>
    <NexusMemora2Readiness076/>
  </main>;
}
