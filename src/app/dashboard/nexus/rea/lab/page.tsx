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
  </main>;
}
