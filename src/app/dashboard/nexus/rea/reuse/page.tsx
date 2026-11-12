"use client";

import {useEffect,useState} from "react";
import {Rea073ReusePanel} from "@/components/nexus/rea-reuse-073";

export default function ReaReusePage(){
  const [runId,setRunId]=useState<number|null>(null);
  useEffect(()=>{
    const input=new URLSearchParams(window.location.search).get("rea_run");
    if(!input||!/^[1-9][0-9]{0,15}$/.test(input))return;
    const parsed=Number(input);
    if(Number.isSafeInteger(parsed))setRunId(parsed);
  },[]);
  return <main className="mx-auto max-w-5xl space-y-5 pb-14">
    <div>
      <p className="text-sm font-semibold text-emerald-700">NEXUS 073 · experimento de triagem</p>
      <h1 className="mt-2 text-2xl font-bold">Mapa de aproveitamento de funcionalidades</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Investigue módulos presentes em um relatório estático verificado. Nenhuma recomendação equivale à aprovação de reutilização.
      </p>
    </div>
    <Rea073ReusePanel runId={runId}/>
  </main>;
}
