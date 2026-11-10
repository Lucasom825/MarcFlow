"use client";

/**
 * NEXUS 060 - isolated proof of the actual MarcFlow FlowEditor component.
 *
 * Only runs at a throwaway Next.js route generated in GitHub Actions.
 * Storage and API calls are completely simulated in this browser tab.
 * This module must never be imported into the production app.
 */
import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowEditor, type LoadedFlow } from "../../src/components/flows/flow-editor";
import type { FlowMeta } from "../../src/components/flows/editor-context";
import type { FlowGraph } from "../../src/modules/flows/types";
import preview from "./exemplo-marcflow-preview.json";

const STORAGE = "nexus060-browser-sandbox";
const PHASE = "nexus060-e2e-phase";
const API = "/api/flows/nexus-sandbox/flow060/draft";
const urlPath = (v: RequestInfo | URL) => {
    if (typeof v === "string") return new URL(v, location.origin);
    if (v instanceof URL) return v;
    return new URL(v.url, location.origin);
};
type Snapshot = { graph: FlowGraph; revision: number };
const seed: Snapshot = { graph: preview.graph as FlowGraph, revision: 0 };
const safeRead = (): Snapshot => {
    try {
        const data = JSON.parse(sessionStorage.getItem(STORAGE) || "null") as Snapshot | null;
        if (data && Number.isSafeInteger(data.revision) && Array.isArray(data.graph?.nodes)
            && Array.isArray(data.graph?.edges)) return data;
    } catch { /* reset invalid synthetic state */ }
    return structuredClone(seed);
};
const response = (obj: unknown, code = 200) =>
    new Response(JSON.stringify(obj), { status: code, headers: { "Content-Type": "application/json" } });
const syntheticFlow = (s: Snapshot): LoadedFlow => ({
    id: "flow060",
    name: "NEXUS 060 · Teste do editor verdadeiro",
    status: "DRAFT",
    draftGraph: structuredClone(s.graph),
    draftRevision: s.revision,
    publishedGraph: null,
    publishedAt: null,
    triggers: [],
    stats: [],
});
const fakeMeta: FlowMeta = { labels: [], fields: [], systemFields: [], flows: [] };

export default function RealEditorSandbox() {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [blocked, setBlocked] = useState(0);
    const [saveCount, setSaveCount] = useState(0);

    useEffect(() => {
        const priorFetch = window.fetch;
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const target = urlPath(input);
            const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
            const isApi = target.pathname.startsWith("/api/");
            if (target.origin !== location.origin) {
                setBlocked(v => v + 1);
                return response({ message: "Acesso externo bloqueado no laboratório." }, 403);
            }
            if (!isApi) return priorFetch.call(window, input, init);
            if (target.pathname === API && method === "PUT") {
                let body: { graph?: FlowGraph; revision?: number };
                try { body = JSON.parse(String(init?.body || "")); }
                catch { return response({ message: "JSON inválido." }, 400); }
                const current = safeRead();
                if (body.revision !== current.revision) {
                    return response({ message: "O fluxo foi alterado em outra aba.", data: { revision: current.revision } }, 409);
                }
                if (!body.graph || !Array.isArray(body.graph.nodes) || !Array.isArray(body.graph.edges)
                    || !body.graph.nodes.some(n => n.type === "start")) {
                    return response({ message: "Grafo inválido." }, 400);
                }
                const newValue: Snapshot = { graph: structuredClone(body.graph), revision: current.revision + 1 };
                sessionStorage.setItem(STORAGE, JSON.stringify(newValue));
                setSaveCount(v => v + 1);
                window.dispatchEvent(new Event("nexus060:save"));
                return response({ data: { revision: newValue.revision }, message: "Salvo em sessão simulada." });
            }
            setBlocked(v => v + 1);
            return response({ message: "API de produção desabilitada nesta bancada." }, 403);
        };
        const initial = safeRead();
        sessionStorage.setItem(STORAGE, JSON.stringify(initial));
        setSnapshot(initial);
        return () => { window.fetch = priorFetch; };
    }, []);

    useEffect(() => {
        if (!snapshot || !new URLSearchParams(location.search).has("e2e")) return;
        const wait = async (p: () => boolean, label: string) => {
            for (let i = 0; i < 140; i++) {
                if (p()) return;
                await new Promise(done => setTimeout(done, 100));
            }
            throw new Error("Falha na etapa: " + label);
        };
        void (async () => {
            try {
                await wait(() => document.querySelectorAll(".react-flow__node").length >= 2, "editor React Flow verdadeiro não montou");
                const phase = sessionStorage.getItem(PHASE) || "";
                if (phase !== "after-save") {
                    if (sessionStorage.getItem(STORAGE) && safeRead().graph.nodes.length !== 2) {
                        throw new Error("Fixture inicial inesperada; nenhuma mutação automática.");
                    }
                    const trigger = document.querySelector('button[title="Adicionar bloco"]') as HTMLButtonElement | null;
                    if (!trigger) throw new Error("Botão de edição real não encontrado.");
                    trigger.click();
                    await wait(() => [...document.querySelectorAll("button")].some(b => b.textContent?.trim() === "Conteúdo"), "menu de blocos");
                    const add = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === "Conteúdo") as HTMLButtonElement;
                    add.click();
                    await wait(() => document.querySelectorAll(".react-flow__node").length === 3, "criação de bloco real");
                    await wait(() => safeRead().graph.nodes.length === 3 && safeRead().revision > 0, "autosave no backend simulado");
                    const saved = safeRead();
                    if (saved.graph.edges.length !== 1 ||
                        !saved.graph.edges.some(e => e.source === "df_1" && e.target === "df_2")) {
                        throw new Error("A conexão importada foi perdida ao editar.");
                    }
                    sessionStorage.setItem(PHASE, "after-save");
                    location.reload();
                    return;
                }
                await wait(() => document.querySelectorAll(".react-flow__node").length === 3, "recarregar blocos persistidos");
                const saved = safeRead();
                if (saved.graph.nodes.length !== 3 || saved.graph.edges.length !== 1 || saved.revision < 1) {
                    throw new Error("Edição não persistiu após recarregamento.");
                }
                if (blocked !== 0) throw new Error("Houve tentativa de API ou origem externa.");
                document.documentElement.dataset.nexus060 = "pass";
                document.documentElement.dataset.nexus060Nodes = "3";
                document.documentElement.dataset.nexus060Edges = "1";
                document.documentElement.dataset.nexus060Revision = String(saved.revision);
            } catch (e) {
                document.documentElement.dataset.nexus060 = "fail";
                document.documentElement.dataset.nexus060Error = e instanceof Error ? e.message : "Erro desconhecido.";
            }
        })();
    }, [snapshot, blocked]);

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            <div id="nexus-060-banner" style={{ flexShrink: 0, padding: "8px 16px", color: "#154367", background: "#e8f3ff", fontFamily: "system-ui", fontSize: 12 }}>
                <b>NEXUS 060 — EDITOR REAL DO MARCFLOW</b> · Ambiente descartável do CI · Nenhum banco ou WhatsApp ·
                Armazenamento simulado na sessão · Nenhuma publicação permitida ·
                Saves: <b id="nexus-060-saves">{saveCount}</b> · APIs bloqueadas: <b id="nexus-060-blocked">{blocked}</b>
            </div>
            <div style={{ flex: 1, minHeight: 500, padding: 14, position: "relative" }}>
                {snapshot ? (
                    <ReactFlowProvider><FlowEditor sessionId="nexus-sandbox" initial={syntheticFlow(snapshot)} initialMeta={fakeMeta} /></ReactFlowProvider>
                ) : <span>Iniciando editor de teste...</span>}
            </div>
        </div>
    );
}
