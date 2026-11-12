"use client";

import { useState, type FormEvent } from "react";
import { ReaVerifiedReport } from "@/components/nexus/rea-verified-report";
import { Rea070Request } from "@/components/nexus/rea-070-request";
import { chooseReaDefaultDirectory } from "@/lib/nexus-rea-scope-071";
import { ExternalLink, GitBranch, ShieldCheck, Search, Copy, AlertTriangle } from "lucide-react";

type Preflight = {
  status: "PREFLIGHT_ONLY";
  repository: string; pinned_sha: string; source_url: string;
  description: string | null; license: string; license_allowlisted_for_toolkit: boolean;
  repository_size_kb: number; entries: number; javascript_files: number; typescript_files: number;
  sample_top_level: string[]; candidate_js_directories: string[];
  package_summary: { name: string | null; scripts: string[]; dependencies: string[] } | null;
  caveat: string;
};
const REA_WORKFLOW = "https://github.com/Lucasom825/rea/actions/workflows/nexus-rea-toolkit.yml";

export default function ReaPreflightPage() {
  const [repository, setRepository] = useState("axios/axios");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Preflight | null>(null);
  const [scope, setScope] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function inspect(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null); setScope(""); setCopied(false);
    try {
      const response = await fetch("/api/nexus/public-inspect?repo=" + encodeURIComponent(repository.trim()), {
        method: "GET", cache: "no-store", credentials: "same-origin",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível consultar o GitHub.");
      setResult(json as Preflight);
      setScope(chooseReaDefaultDirectory((json as Preflight).candidate_js_directories));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar o projeto.");
    } finally { setLoading(false); }
  }
  const canRun = !!result?.license_allowlisted_for_toolkit && !!scope && !!result.javascript_files;
  const workflowInstructions = result ? [
    "target: public",
    "repository: " + result.repository,
    "commit: " + result.pinned_sha,
    "directory: " + (scope || "(selecione uma pasta com JavaScript)"),
  ].join("\n") : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-14">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <GitBranch className="h-4 w-4" /> NEXUS 070 · análise supervisionada de código público
        </div>
        <h1 className="text-3xl font-bold text-foreground">Explorar repositório com a REA</h1>
        <p className="text-sm text-muted-foreground">
          Primeiro, inspecione o repositório público sem instalar ou executar seu código.
          Em seguida, solicite a análise na REA com autorização segura no servidor, ou use o workflow manual.
        </p>
      </header>

      <ReaVerifiedReport />

      <form onSubmit={inspect} className="rounded-2xl border bg-card p-5 space-y-3">
        <label htmlFor="nexus-repository" className="text-sm font-semibold">Repositório público no GitHub</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="nexus-repository" value={repository} onChange={e => setRepository(e.target.value)}
            placeholder="axios/axios ou https://github.com/axios/axios" maxLength={250}
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-3 text-sm" />
          <button type="submit" disabled={loading || !repository.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <Search className="h-4 w-4" /> {loading ? "Consultando..." : "Pré-analisar"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Exemplo: axios/axios. Consulta pública gratuita sujeita aos limites do GitHub. Repositórios privados são recusados.</p>
      </form>

      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {result && (
        <>
          <section className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{result.repository}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{result.description || "Descrição não informada"}</p>
              </div>
              <a href={result.source_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline">
                Ver código fixado <ExternalLink className="h-4 w-4"/>
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Arquivos listados", String(result.entries)],
                ["JavaScript", String(result.javascript_files)],
                ["TypeScript", String(result.typescript_files)],
                ["Licença declarada", result.license],
              ].map(([label,value]) => (
                <div key={label} className="rounded-xl bg-muted/60 p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 break-words text-base font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground break-all"><strong>Commit imutável:</strong> {result.pinned_sha}</div>
            <div className="text-sm"><strong>Diretórios e arquivos principais:</strong> {result.sample_top_level.join(" · ")}</div>
            {result.package_summary && (
              <div className="rounded-xl border p-3 text-sm space-y-1">
                <p><strong>package.json:</strong> {result.package_summary.name || "sem nome"}</p>
                <p><strong>Dependências declaradas (amostra):</strong> {result.package_summary.dependencies.join(", ") || "nenhuma listada"}</p>
                <p><strong>Scripts encontrados, não executados:</strong> {result.package_summary.scripts.join(", ") || "nenhum"}</p>
              </div>
            )}
          </section>
          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Próxima etapa: REA real</h2>
            <p className="text-sm text-muted-foreground">
              A pré-análise lista metadados públicos sem executar código externo.
              Para solicitar a análise estática na REA pelo GitHub Actions, use o botão abaixo com sessão e autorização seguras.
              Isso não testa o funcionamento do aplicativo nem o reconstrói.
            </p>
            <label htmlFor="nexus-scope" className="text-sm font-medium">Pasta de JavaScript para inspecionar na REA</label>
            <select id="nexus-scope" className="w-full rounded-lg border bg-background p-3 text-sm"
              value={scope} onChange={e => {setScope(e.target.value);setCopied(false)}}>
              <option value="">Nenhuma pasta adequada identificada</option>
              {result.candidate_js_directories.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {!result.license_allowlisted_for_toolkit && (
              <p className="flex gap-2 text-sm text-amber-700"><AlertTriangle className="h-5 w-5 shrink-0" /> Licença não incluída na lista permitida do workflow atual. Pare e revise antes de executar.</p>
            )}
            {!result.javascript_files && <p className="text-sm text-amber-700">O workflow existente requer código JavaScript; a pré-análise não encontrou arquivos compatíveis.</p>}
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-white">{workflowInstructions}</pre>
            <Rea070Request target={result} scope={scope}/>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={!canRun} onClick={async () => {
                  try { await navigator.clipboard.writeText(workflowInstructions); setCopied(true); } catch { setCopied(false); }
                }} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-40">
                <Copy className="h-4 w-4"/> {copied ? "Parâmetros copiados" : "Copiar parâmetros"}
              </button>
              <a href={REA_WORKFLOW} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline">
                Abrir workflow oficial do seu fork REA <ExternalLink className="h-4 w-4"/>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">No GitHub Actions escolha <strong>Run workflow</strong>, target <strong>public</strong>, e preencha os campos acima. Não execute código de terceiros no NEXUS. A licença declarada não equivale a parecer jurídico.</p>
          </section>
        </>
      )}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Limite desta versão:</strong> a pré-análise não é engenharia reversa funcional. Não há importação ou instalação automática; WhatsApp, publicação e serviços produtivos permanecem bloqueados.
      </div>
    </div>
  );
}
