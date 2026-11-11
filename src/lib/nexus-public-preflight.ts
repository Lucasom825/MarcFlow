/**
 * NEXUS 067 — bounded public GitHub repository preflight.
 * Deliberately NOT a REA engine run: source metadata/manifest only.
 * Never clones, installs, executes, writes or imports target source.
 */
export class PreflightError extends Error {
    constructor(public code: string, message: string) { super(message); }
}
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/;
export function parsePublicRepository(input: string): { owner: string; repo: string } {
    let cleaned = String(input || "").trim();
    if (cleaned.startsWith("https://github.com/")) {
        const url = new URL(cleaned);
        if (url.hostname !== "github.com" || url.username || url.password || url.port
            || url.search || url.hash || url.pathname.split("/").filter(Boolean).length !== 2) {
            throw new PreflightError("INVALID_REPO", "Use o endereço principal do repositório público.");
        }
        cleaned = url.pathname.slice(1);
    }
    const segments = cleaned.split("/");
    if (segments.length !== 2 || segments.some(v => !SEGMENT.test(v)
        || v === "." || v === ".." || v.endsWith(".git"))) {
        throw new PreflightError("INVALID_REPO", "Informe owner/repo ou https://github.com/owner/repo.");
    }
    return { owner: segments[0], repo: segments[1] };
}

type GitHubFetcher = (path: string) => Promise<unknown>;
type GithubTreeItem = { path?: string; type?: string; size?: number };
const ALLOW_LICENSE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "GPL-3.0", "LGPL-3.0"]);
const MAX_REPOSITORY_KB = 75_000;
const MAX_TREE_FILES = 3000;
export async function inspectPublicRepo(input: string, get: GitHubFetcher) {
    const { owner, repo } = parsePublicRepository(input);
    const prefix = "/repos/" + owner + "/" + repo;
    const metadata = await get(prefix) as Record<string, any>;
    if (!metadata || metadata.private !== false) throw new PreflightError("NOT_PUBLIC", "Repositório não confirmado como público.");
    if (metadata.archived) throw new PreflightError("ARCHIVED", "Repositório arquivado; escolha uma opção ativa.");
    if (!Number.isInteger(metadata.size) || metadata.size > MAX_REPOSITORY_KB)
        throw new PreflightError("SIZE_LIMIT", "Repositório grande demais para esta pré-análise.");
    if (typeof metadata.default_branch !== "string" || metadata.default_branch.length > 120)
        throw new PreflightError("INVALID_BRANCH", "Branch padrão não disponível.");

    const shaRecord = await get(prefix + "/commits/" + encodeURIComponent(metadata.default_branch)) as Record<string, any>;
    const sha = shaRecord?.sha;
    if (typeof sha !== "string" || !/^[a-f0-9]{40}$/i.test(sha))
        throw new PreflightError("INVALID_SHA", "Não foi possível fixar uma versão imutável do projeto.");

    const tree = await get(prefix + "/git/trees/" + sha + "?recursive=1") as Record<string, any>;
    if (!tree || tree.truncated !== false || !Array.isArray(tree.tree) || tree.tree.length > MAX_TREE_FILES)
        throw new PreflightError("TREE_INCOMPLETE", "A árvore de arquivos ultrapassou os limites ou está incompleta.");
    const files: GithubTreeItem[] = tree.tree.filter((x: GithubTreeItem) =>
        x && x.type === "blob" && typeof x.path === "string" && x.path.length <= 280);
    const js = files.filter(x => x.path && /\.(?:js|mjs|cjs|jsx)$/i.test(x.path));
    const ts = files.filter(x => x.path && /\.(?:ts|tsx|mts|cts)$/i.test(x.path));
    const top = [...new Set(files.map(x => x.path!.split("/")[0]))].slice(0, 25);
    const evidenceFolders = [...new Set(js.map(x => x.path!.split("/").slice(0,-1).join("/") || "."))
        ].filter(x => x !== "." && x.length <= 180 && /^[A-Za-z0-9_./@-]+$/.test(x))
        .sort((a,b) => js.filter(x => x.path!.startsWith(a + "/")).length -
                       js.filter(x => x.path!.startsWith(b + "/")).length).reverse().slice(0,8);
    const license = typeof metadata.license?.spdx_id === "string" ? metadata.license.spdx_id : "NÃO VERIFICADA";

    // Manifest is read as text only (no npm install, no scripts, no execution).
    let packageSummary: { name: string | null; scripts: string[]; dependencies: string[] } | null = null;
    if (files.some(x => x.path === "package.json")) {
        try {
            const raw = await get(prefix + "/contents/package.json?ref=" + sha) as Record<string, any>;
            if (raw?.encoding === "base64" && typeof raw.content === "string" && raw.content.length < 180_000) {
                const pkg = JSON.parse(Buffer.from(raw.content, "base64").toString("utf8"));
                if (pkg && typeof pkg === "object" && !Array.isArray(pkg)) {
                    packageSummary = {
                        name: typeof pkg.name === "string" ? pkg.name.slice(0,100) : null,
                        scripts: pkg.scripts && typeof pkg.scripts === "object" && !Array.isArray(pkg.scripts)
                            ? Object.keys(pkg.scripts).slice(0,20) : [],
                        dependencies: pkg.dependencies && typeof pkg.dependencies === "object" && !Array.isArray(pkg.dependencies)
                            ? Object.keys(pkg.dependencies).slice(0,40) : [],
                    };
                }
            }
        } catch { /* Explicitly incomplete instead of inventing a manifest. */ }
    }
    return {
        status: "PREFLIGHT_ONLY" as const,
        repository: owner + "/" + repo,
        pinned_sha: sha.toLowerCase(),
        source_url: "https://github.com/" + owner + "/" + repo + "/tree/" + sha,
        description: typeof metadata.description === "string" ? metadata.description.slice(0,320) : null,
        license,
        license_allowlisted_for_toolkit: ALLOW_LICENSE.has(license),
        repository_size_kb: metadata.size as number,
        entries: files.length,
        javascript_files: js.length,
        typescript_files: ts.length,
        sample_top_level: top,
        candidate_js_directories: evidenceFolders,
        package_summary: packageSummary,
        caveat: "Leitura estática preliminar; a REA ainda não foi executada. Licença requer avaliação humana e dependências não foram instaladas.",
    };
}

/** Fetcher bound to a CONSTANT trusted domain; input is validated before URL construction. */
export async function fetchPublicGithub(path: string): Promise<unknown> {
    if (!/^\/repos\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\/|$)/.test(path))
        throw new PreflightError("INVALID_ENDPOINT", "Endpoint não permitido.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
        const res = await fetch("https://api.github.com" + path, {
            method: "GET", cache: "no-store", redirect: "error",
            headers: { Accept: "application/vnd.github+json", "User-Agent": "nexus067-public-source-inspector" },
            signal: controller.signal,
        });
        if (res.status === 404) throw new PreflightError("NOT_FOUND", "Repositório público não encontrado.");
        if (res.status === 403 || res.status === 429) throw new PreflightError("RATE_LIMIT", "Limite público do GitHub atingido. Tente novamente mais tarde.");
        if (!res.ok) throw new PreflightError("GITHUB_UNAVAILABLE", "GitHub indisponível (" + res.status + ").");
        const bytes = Number(res.headers.get("content-length") || 0);
        if (bytes > 2_000_000) throw new PreflightError("RESPONSE_SIZE", "Resposta grande demais.");
        const text = await res.text();
        if (text.length > 2_000_000) throw new PreflightError("RESPONSE_SIZE", "Resposta grande demais.");
        return JSON.parse(text);
    } finally { clearTimeout(timer); }
}
