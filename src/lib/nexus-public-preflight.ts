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
    const allowed = /^\/repos\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}(?:$|\/commits\/[A-Za-z0-9._%+-]+|\/git\/trees\/[a-fA-F0-9]{40}\?recursive=1|\/contents\/package\.json\?ref=[a-fA-F0-9]{40})$/;
    if (!allowed.test(path) || path.includes("..") || /%2e/i.test(path))
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
