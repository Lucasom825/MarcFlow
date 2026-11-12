"use client";

import Link from "next/link";
import {NexusMemoraContract075} from "@/components/nexus/nexus-memora-contract-075";

export default function NexusMemoraContractPage(){
  return <main className="mx-auto max-w-5xl space-y-5 pb-14">
    <Link href="/dashboard/nexus/rea/lab"
      className="text-sm text-emerald-800 underline">Voltar ao laboratório NEXUS 074</Link>
    <NexusMemoraContract075/>
  </main>;
}
