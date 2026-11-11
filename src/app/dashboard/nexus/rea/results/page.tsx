import Link from "next/link";
import {ReaVerifiedReport} from "@/components/nexus/rea-verified-report";
export default function ReaResultsPage(){
  return <div className="mx-auto max-w-5xl space-y-5 pb-14">
    <div>
      <Link href="/dashboard/nexus/rea" className="text-sm font-medium text-emerald-700 underline">
        Voltar à exploração de projetos públicos
      </Link>
      <h1 className="mt-3 text-3xl font-bold">Resultados verificados pela REA</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A fonte é o resumo gerado automaticamente pela análise estática GitHub Actions na branch experimental.
        A autenticidade da execução concluída é consultada no GitHub sempre que a página é carregada.
      </p>
    </div>
    <ReaVerifiedReport detailed/>
  </div>;
}
