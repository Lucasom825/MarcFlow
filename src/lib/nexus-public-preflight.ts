/**
 * NEXUS 067: public GitHub metadata preview ONLY.
 * No target checkout, installation, execution, mutations or private repository access.
 */
export class PreflightError extends Error {
    constructor(public code: string, message: string) { super(message); }
}
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/;
export function parsePublicRepository(input: string): {owner:string;repo:string} {
    let value = String(input || "").trim();
    if (value.startsWith("https://github.com/")) {
        const url = new URL(value);
        if (url.hostname !== "github.com" || url.username || url.password || url.port ||
            url.search || url.hash || url.pathname.split("/").filter(Boolean).length !== 2)
            throw new PreflightError("INVALID_REPO", "Use o endereço principal do repositório público.");
        value = url.pathname.slice(1);
    }
    const seg = value.split("/");
    if (seg.length !== 2 || seg.some(v => !SEGMENT.test(v) || v === "." || v === ".." || v.endsWith(".git")))
        throw new PreflightError("INVALID_REPO", "Informe owner/repo ou https://github.com/owner/repo.");
    return {owner:seg[0],repo:seg[1]};
}
type GitHubFetcher = (path:string)=>Promise<unknown>;
type TreeItem = {path?:string;type?:string;size?:number};
const APPROVED_LICENSES = new Set(["MIT","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC","MPL-2.0","GPL-3.0","LGPL-3.0"]);
export async function inspectPublicRepo(input:string,get:GitHubFetcher) {
    const {owner,repo}=parsePublicRepository(input);
    const prefix="/repos/"+owner+"/"+repo;
    const meta=await get(prefix) as Record<string,any>;
    if (!meta || meta.private!==false) throw new PreflightError("NOT_PUBLIC","Não foi possível confirmar que o repositório é público.");
    if (meta.archived) throw new PreflightError("ARCHIVED","Repositório arquivado.");
    if (!Number.isInteger(meta.size)||meta.size>75000||meta.size<0)
        throw new PreflightError("SIZE_LIMIT","Repositório grande demais para esta pré-análise.");
    if(typeof meta.default_branch!=="string"||meta.default_branch.length>120||!meta.default_branch)
        throw new PreflightError("INVALID_BRANCH","Branch padrão indisponível.");
    const commit=await get(prefix+"/commits/"+encodeURIComponent(meta.default_branch)) as Record<string,any>;
    const sha=commit?.sha;
    if(typeof sha!=="string"||!/^[a-f0-9]{40}$/i.test(sha))
        throw new PreflightError("INVALID_SHA","Não foi possível obter um commit imutável.");
    const tree=await get(prefix+"/git/trees/"+sha+"?recursive=1") as Record<string,any>;
    if(!tree||tree.truncated!==false||!Array.isArray(tree.tree)||tree.tree.length>3000)
        throw new PreflightError("TREE_INCOMPLETE","Árvore de arquivos excede os limites ou está incompleta.");
    const files:TreeItem[]=tree.tree.filter((x:TreeItem)=>x&&x.type==="blob"&&typeof x.path==="string"&&x.path.length<=280);
    const js=files.filter(x=>x.path&&/\.(?:js|mjs|cjs|jsx)$/i.test(x.path));
    const ts=files.filter(x=>x.path&&/\.(?:ts|tsx|mts|cts)$/i.test(x.path));
    const top=[...new Set(files.map(x=>x.path!.split("/")[0]))].slice(0,25);
    const counts=new Map<string,number>();
    for(const file of js) {
        const segments=file.path!.split("/");
        for(let i=1;i<segments.length;i++) {
            const folder=segments.slice(0,i).join("/");
            if(folder.length<=180&&/^[A-Za-z0-9_./@-]+$/.test(folder)&&!folder.split("/").includes(".."))
                counts.set(folder,(counts.get(folder)||0)+1);
        }
    }
    const dirs=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8).map(x=>x[0]);
    const license=typeof meta.license?.spdx_id==="string"?meta.license.spdx_id:"NÃO VERIFICADA";
    let pkgSummary:{name:string|null;scripts:string[];dependencies:string[]}|null=null;
    if(files.some(x=>x.path==="package.json")) {
        try {
            const response=await get(prefix+"/contents/package.json?ref="+sha) as Record<string,any>;
            if(response?.encoding==="base64"&&typeof response.content==="string"&&response.content.length<=180000) {
                const pkg=JSON.parse(Buffer.from(response.content,"base64").toString("utf8"));
                if(pkg&&typeof pkg==="object"&&!Array.isArray(pkg)) {
                    pkgSummary={
                        name:typeof pkg.name==="string"?pkg.name.slice(0,100):null,
                        scripts:pkg.scripts&&typeof pkg.scripts==="object"&&!Array.isArray(pkg.scripts)?Object.keys(pkg.scripts).slice(0,20):[],
                        dependencies:pkg.dependencies&&typeof pkg.dependencies==="object"&&!Array.isArray(pkg.dependencies)?Object.keys(pkg.dependencies).slice(0,40):[]
                    };
                }
            }
        }catch { /* A manifest is optional: never claim it was validated when parsing fails. */ }
    }
    return {
        status:"PREFLIGHT_ONLY" as const,
        repository:owner+"/"+repo, pinned_sha:sha.toLowerCase(),
        source_url:"https://github.com/"+owner+"/"+repo+"/tree/"+sha,
        description:typeof meta.description==="string"?meta.description.slice(0,320):null,
        license,license_allowlisted_for_toolkit:APPROVED_LICENSES.has(license),
        repository_size_kb:meta.size as number, entries:files.length,
        javascript_files:js.length,typescript_files:ts.length,
        sample_top_level:top,candidate_js_directories:dirs,package_summary:pkgSummary,
        caveat:"Pré-análise estática do GitHub. A REA não foi executada; licenças requerem avaliação humana."
    };
}

/** Fixed GitHub API host; only repository metadata, commits, tree and root package.json. */
export async function fetchPublicGithub(path:string):Promise<unknown> {
    const allowed=/^\/repos\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}(?:$|\/commits\/[A-Za-z0-9._%+-]+|\/git\/trees\/[a-fA-F0-9]{40}\?recursive=1|\/contents\/package\.json\?ref=[a-fA-F0-9]{40})$/;
    if(!allowed.test(path)||path.includes("..")||/%2e/i.test(path))
        throw new PreflightError("INVALID_ENDPOINT","Endpoint não permitido.");
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8500);
    try {
        const response=await fetch("https://api.github.com"+path,{
            method:"GET",redirect:"error",cache:"no-store",
            headers:{Accept:"application/vnd.github+json","User-Agent":"nexus067-public-readonly"},
            signal:controller.signal
        });
        if(response.status===404)throw new PreflightError("NOT_FOUND","Repositório não encontrado.");
        if(response.status===403||response.status===429)throw new PreflightError("RATE_LIMIT","Limite público do GitHub atingido.");
        if(!response.ok)throw new PreflightError("GITHUB_UNAVAILABLE","GitHub indisponível ("+response.status+").");
        const size=Number(response.headers.get("content-length")||0);
        if(size>2_000_000)throw new PreflightError("RESPONSE_SIZE","Resposta muito grande.");
        const payload=await response.text();
        if(payload.length>2_000_000)throw new PreflightError("RESPONSE_SIZE","Resposta muito grande.");
        return JSON.parse(payload);
    } finally {clearTimeout(timer);}
}
