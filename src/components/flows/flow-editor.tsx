"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    ReactFlow, Background, BackgroundVariant, BaseEdge, EdgeLabelRenderer, getBezierPath, useEdgesState, useNodesState, useReactFlow,
    type Connection, type Edge, type EdgeProps, type Node, type NodeMouseHandler, type IsValidConnection,
} from "@xyflow/react";
import {
    AlertTriangle, ArrowLeft, Bot, Check, CloudOff, History, Loader2, Maximize, Play, Plus, Redo2, Rocket, SlidersHorizontal, Trash2, Undo2, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ADDABLE_BLOCKS, BLOCKS, defaultData, newId, validateGraph, type FlowEdge, type FlowGraph, type FlowNode, type GraphIssue, type NodeType,
} from "@/modules/flows/types";
import { BlockNode, BLOCK_ICONS } from "./block-node";
import { BlockPanel } from "./block-panel";
import { EditorContext, type EditorApi, type FlowMeta } from "./editor-context";
import { BotVarsDialog, IssuesList, RunsSheet, SimulatorSheet, TestDialog, TriggersDialog, type Trigger } from "./flow-dialogs";

export interface LoadedFlow {
    id: string;
    name: string;
    status: "DRAFT" | "ACTIVE" | "PAUSED";
    draftGraph: FlowGraph;
    draftRevision: number;
    publishedGraph: FlowGraph | null;
    publishedAt: string | null;
    triggers: Trigger[];
    stats: { nodeId: string; key: string; count: number }[];
}

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const nodeTypes = Object.fromEntries((Object.keys(BLOCKS) as NodeType[]).map(t => [t, BlockNode]));

function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
    const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    const { setEdges } = useReactFlow();
    return (
        <>
            <BaseEdge id={id} path={path} interactionWidth={14}
                style={{ stroke: selected ? "var(--primary)" : "#9CA3AF", strokeWidth: 2.5, strokeDasharray: selected ? "8 3" : undefined, animation: selected ? "flowdash 0.6s linear infinite" : undefined }} />
            {selected && (
                <EdgeLabelRenderer>
                    <button type="button" title="Remover conexão" onClick={() => setEdges(es => es.filter(e => e.id !== id))}
                        className="nodrag nopan absolute flex h-7 w-7 items-center justify-center rounded-md border bg-card text-destructive shadow-md hover:bg-destructive/10"
                        style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, pointerEvents: "all" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
const edgeTypes = { flow: FlowEdgeView };

const toRfNodes = (g: FlowGraph): Node[] => g.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data as Record<string, unknown>, deletable: n.type !== "start" }));
const toRfEdges = (g: FlowGraph): Edge[] => g.edges.map(e => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, type: "flow" }));
/**
 * Stable JSON representation of FlowGraph. MySQL JSON columns may normalize object key
 * ordering, which otherwise makes an unchanged graph look dirty on reload and triggers
 * an extra PUT /draft. This comparison is semantic for JSON object key order only:
 * array order, values, nodes, edges, and positions remain significant.
 */
const stableGraphJSON = (graph: FlowGraph): string => JSON.stringify(graph, (_, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return value;
});

const toGraph = (nodes: Node[], edges: Edge[]): FlowGraph => ({
    nodes: nodes.map(n => ({ id: n.id, type: n.type as NodeType, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data } as FlowNode)),
    edges: edges.map(e => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle || "next", target: e.target } as FlowEdge)),
});

export function FlowEditor({ sessionId, initial, initialMeta }: { sessionId: string; initial: LoadedFlow; initialMeta: FlowMeta }) {
    const rf = useReactFlow();
    const wrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toRfNodes(initial.draftGraph));
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toRfEdges(initial.draftGraph));
    const [meta, setMeta] = useState(initialMeta);
    const [name, setName] = useState(initial.name);
    const [status, setStatus] = useState(initial.status);
    const [published, setPublished] = useState<string | null>(initial.publishedGraph ? stableGraphJSON(initial.publishedGraph) : null);
    const [triggers, setTriggers] = useState<Trigger[]>(initial.triggers);
    const [panelId, setPanelId] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<SaveState>("saved");
    const [toDelete, setToDelete] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [issuesOpen, setIssuesOpen] = useState(false);
    const [dialog, setDialog] = useState<"triggers" | "test" | "runs" | "settings" | "simulate" | null>(null);
    const [busy, setBusy] = useState<"publish" | null>(null);

    const revision = useRef(initial.draftRevision);
    const lastSaved = useRef(stableGraphJSON(initial.draftGraph));
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const undo = useRef<string[]>([lastSaved.current]);
    const redo = useRef<string[]>([]);

    const graph = useMemo(() => toGraph(nodes, edges), [nodes, edges]);
    const serialized = useMemo(() => stableGraphJSON(graph), [graph]);
    const issues = useMemo(() => validateGraph(graph), [graph]);
    const errors = issues.filter(i => i.level === "error");
    const issuesByNode = useMemo(() => {
        const m: Record<string, GraphIssue[]> = {};
        for (const i of issues) if (i.nodeId) (m[i.nodeId] ||= []).push(i);
        return m;
    }, [issues]);
    const statMap = useMemo(() => new Map(initial.stats.map(s => [`${s.nodeId}|${s.key}`, s.count])), [initial.stats]);

    // ---------- saving (whole draft + revision; see docs/botconversa-re/07) ----------
    const saveNow = useCallback(async (): Promise<boolean> => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        const body = serializedRef.current;
        if (body === lastSaved.current) return true;
        setSaveState("saving");
        try {
            const res = await fetch(`/api/flows/${sessionId}/${initial.id}/draft`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ graph: JSON.parse(body), revision: revision.current }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.status === 409) {
                setSaveState("conflict");
                toast.error(json.message, { duration: 15000, action: { label: "Recarregar", onClick: () => location.reload() } });
                return false;
            }
            if (!res.ok) { setSaveState("error"); toast.error(json.message || "Falha ao salvar"); return false; }
            revision.current = json.data.revision;
            lastSaved.current = body;
            setSaveState(serializedRef.current === body ? "saved" : "dirty");
            return true;
        } catch {
            setSaveState("error");
            return false;
        }
    }, [sessionId, initial.id]);

    const serializedRef = useRef(serialized);
    serializedRef.current = serialized;

    useEffect(() => {
        if (serialized === lastSaved.current || saveState === "conflict") return;
        setSaveState(s => (s === "saving" ? s : "dirty"));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { saveNow(); }, 800);
        const h = setTimeout(() => {
            if (undo.current[undo.current.length - 1] !== serialized) {
                undo.current.push(serialized);
                if (undo.current.length > 60) undo.current.shift();
                redo.current = [];
            }
        }, 400);
        return () => clearTimeout(h);
    }, [serialized, saveNow, saveState]);

    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => { if (serializedRef.current !== lastSaved.current) { e.preventDefault(); } };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);

    const applyGraph = (s: string) => {
        const g = JSON.parse(s) as FlowGraph;
        setNodes(toRfNodes(g));
        setEdges(toRfEdges(g));
    };
    const doUndo = useCallback(() => {
        if (undo.current.length < 2) return;
        redo.current.push(undo.current.pop()!);
        applyGraph(undo.current[undo.current.length - 1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const doRedo = useCallback(() => {
        const s = redo.current.pop();
        if (!s) return;
        undo.current.push(s);
        applyGraph(s);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- graph operations ----------
    const updateNode = useCallback((id: string, data: unknown) => {
        setNodes(ns => ns.map(n => (n.id === id ? { ...n, data: data as Record<string, unknown> } : n)));
    }, [setNodes]);

    const deleteNode = useCallback((id: string) => {
        setNodes(ns => ns.filter(n => n.id !== id));
        setEdges(es => es.filter(e => e.source !== id && e.target !== id));
        setPanelId(p => (p === id ? null : p));
    }, [setNodes, setEdges]);

    const freeSpot = useCallback((x: number, y: number) => {
        const ns = rf.getNodes();
        let py = y;
        for (let i = 0; i < 40 && ns.some(n => Math.abs(n.position.x - x) < 240 && Math.abs(n.position.y - py) < 140); i++) py += 80;
        return { x, y: py };
    }, [rf]);

    const duplicateNode = useCallback((id: string) => {
        const src = rf.getNode(id);
        if (!src || src.type === "start") return;
        const copy: Node = { ...src, id: newId(), selected: true, position: freeSpot(src.position.x + 290, src.position.y), data: structuredClone(src.data) };
        setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), copy]);
        setPanelId(copy.id);
    }, [rf, setNodes, freeSpot]);

    const addBlock = (type: NodeType) => {
        const rect = wrapper.current!.getBoundingClientRect();
        const c = rf.screenToFlowPosition({ x: rect.left + rect.width / 2 + (panelId ? 190 : 0), y: rect.top + rect.height / 2 - 80 });
        const node: Node = { id: newId(), type, position: freeSpot(c.x - 125, c.y), data: defaultData(type) as Record<string, unknown>, selected: true, deletable: true };
        setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), node]);
        setPanelId(node.id);
        setAddOpen(false);
    };

    const onConnect = useCallback((c: Connection) => {
        const handle = c.sourceHandle || "next";
        setEdges(es => [
            ...es.filter(e => !(e.source === c.source && (e.sourceHandle || "next") === handle)), // one target per output
            { id: newId(), source: c.source, sourceHandle: handle, target: c.target, type: "flow" },
        ]);
    }, [setEdges]);

    const isValidConnection: IsValidConnection = useCallback(c => c.source !== c.target && rf.getNode(c.target)?.type !== "start", [rf]);

    const onNodeClick: NodeMouseHandler = useCallback((_, n) => setPanelId(n.id), []);

    const focusNode = (id?: string) => {
        setIssuesOpen(false);
        if (!id) return;
        const n = rf.getNode(id);
        if (!n) return;
        setNodes(ns => ns.map(x => ({ ...x, selected: x.id === id })));
        setPanelId(id);
        rf.setCenter(n.position.x + 125 - 190 / rf.getZoom(), n.position.y + 80, { zoom: Math.max(rf.getZoom(), 0.8), duration: 400 });
    };

    // ---------- keyboard ----------
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (t.closest("input, textarea, [contenteditable=true], [role=dialog]")) return;
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
            else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); }
            else if (mod && e.key.toLowerCase() === "d") {
                e.preventDefault();
                const sel = rf.getNodes().find(n => n.selected);
                if (sel) duplicateNode(sel.id);
            } else if (e.key === "Escape") setPanelId(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [doUndo, doRedo, duplicateNode, rf]);

    // ---------- server actions ----------
    const api = async (path: string, init?: RequestInit) => {
        const res = await fetch(`/api/flows/${sessionId}/${initial.id}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
        const json = await res.json().catch(() => ({}));
        return { res, json };
    };

    const publish = async () => {
        if (errors.length) { setIssuesOpen(true); return; }
        setBusy("publish");
        if (!(await saveNow())) { setBusy(null); return; }
        const { res, json } = await api("/publish", { method: "POST" });
        setBusy(null);
        if (!res.ok) { toast.error(json.message); if (json.data?.issues) setIssuesOpen(true); return; }
        setStatus("ACTIVE");
        setPublished(serializedRef.current);
        toast.success(triggers.length ? "Fluxo publicado e ativo" : "Fluxo publicado. Configure um gatilho para ele começar sozinho.");
        if (!triggers.length) setDialog("triggers");
    };

    const runTest = async (phone: string) => {
        if (errors.length) { setIssuesOpen(true); toast.error("Corrija os erros antes de testar"); return false; }
        if (!(await saveNow())) return false;
        const { res, json } = await api("/test", { method: "POST", body: JSON.stringify({ phone }) });
        if (!res.ok) { toast.error(json.message); return false; }
        toast.success(json.message);
        return true;
    };

    const toggleStatus = async (on: boolean) => {
        const { res, json } = await api("", { method: "PATCH", body: JSON.stringify({ status: on ? "ACTIVE" : "PAUSED" }) });
        if (!res.ok) return toast.error(json.message);
        setStatus(json.data.status);
        toast.success(on ? "Fluxo ativado" : "Fluxo pausado: novos contatos não entram; conversas em andamento continuam");
    };

    const rename = async () => {
        const v = name.trim();
        if (!v || v === initial.name) { setName(v || initial.name); return; }
        const { res, json } = await api("", { method: "PATCH", body: JSON.stringify({ name: v }) });
        if (!res.ok) toast.error(json.message);
    };

    const reloadMeta = useCallback(async () => {
        const res = await fetch(`/api/flows/${sessionId}/meta`);
        const json = await res.json().catch(() => ({}));
        if (res.ok) setMeta(json.data);
    }, [sessionId]);

    const ctx: EditorApi = {
        sessionId, flowId: initial.id, meta, reloadMeta, issuesByNode,
        stat: (nodeId, key) => statMap.get(`${nodeId}|${key}`) ?? 0,
        updateNode: updateNode as EditorApi["updateNode"],
        requestDelete: setToDelete, duplicateNode, openPanel: setPanelId,
    };

    const panelNode = panelId ? graph.nodes.find(n => n.id === panelId) : undefined;
    const unpublished = published !== null && published !== serialized;

    return (
        <EditorContext.Provider value={ctx}>
            <style>{`@keyframes flowdash { to { stroke-dashoffset: -22; } } .react-flow__handle { transition: transform .1s } .react-flow__handle:hover { transform: scale(1.25) }`}</style>
            <div className="-m-3 flex h-[calc(100%+1.5rem)] flex-col sm:-m-4 sm:h-[calc(100%+2rem)] lg:-m-6 lg:h-[calc(100%+3rem)]">
                {/* top bar */}
                <header className="flex h-16 shrink-0 items-center gap-2 overflow-x-auto border-b bg-card px-3 sm:px-4">
                    <Button asChild size="icon" variant="ghost" className="h-9 w-9 shrink-0" title="Voltar para a lista"><Link href="/dashboard/flows"><ArrowLeft className="h-4 w-4" /></Link></Button>
                    <span className="hidden text-sm text-muted-foreground xl:inline">Fluxos /</span>
                    <input value={name} onChange={e => setName(e.target.value)} onBlur={rename} onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className="w-32 shrink-0 truncate rounded-md bg-transparent px-1.5 py-1 text-[15px] font-semibold outline-none hover:bg-muted focus:bg-muted sm:w-44 xl:w-56" title="Clique para renomear" />
                    <Badge variant="secondary" className={status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-600" : status === "PAUSED" ? "bg-amber-500/15 text-amber-600" : ""}>
                        {status === "ACTIVE" ? "Ativo" : status === "PAUSED" ? "Pausado" : "Rascunho"}
                    </Badge>
                    {unpublished && <Badge variant="outline" className="hidden border-amber-500/40 text-amber-600 md:inline-flex">Alterações não publicadas</Badge>}
                    <SaveIndicator state={saveState} onRetry={saveNow} />

                    <div className="ml-auto flex items-center gap-1.5">
                        <Button size="icon" variant="ghost" className="hidden h-9 w-9 xl:inline-flex" title="Desfazer (Ctrl+Z)" onClick={doUndo}><Undo2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="hidden h-9 w-9 xl:inline-flex" title="Refazer (Ctrl+Shift+Z)" onClick={doRedo}><Redo2 className="h-4 w-4" /></Button>
                        {published !== null && (
                            <label className="hidden items-center gap-1.5 text-sm md:flex" title="Ativa ou pausa a entrada de novos contatos">
                                <Switch checked={status === "ACTIVE"} onCheckedChange={toggleStatus} />Ativo
                            </label>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setDialog("triggers")}><Zap className="h-4 w-4" /><span className="hidden xl:inline">Gatilhos</span>{triggers.length > 0 && <span className="rounded bg-background px-1 text-[11px]">{triggers.length}</span>}</Button>
                        <Button variant="secondary" size="sm" onClick={() => setDialog("runs")}><History className="h-4 w-4" /><span className="hidden xl:inline">Execuções</span></Button>
                        <Button variant="secondary" size="sm" onClick={() => setDialog("settings")} title="Valores usados nas mensagens (preço, links...)"><SlidersHorizontal className="h-4 w-4" /><span className="hidden xl:inline">Configurações</span></Button>
                        <Button variant="secondary" size="sm" onClick={() => setDialog("simulate")} title="Conversar com o rascunho sem enviar nada pelo WhatsApp"><Bot className="h-4 w-4" /><span className="hidden xl:inline">Simular</span></Button>
                        <Button variant="secondary" size="sm" onClick={() => setDialog("test")}><Play className="h-4 w-4" /><span className="hidden xl:inline">Testar</span></Button>
                        <Popover open={issuesOpen} onOpenChange={setIssuesOpen}>
                            <PopoverTrigger asChild>
                                <Button size="sm" onClick={e => { e.preventDefault(); publish(); }} disabled={busy === "publish"}>
                                    {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : errors.length ? <AlertTriangle className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                                    Publicar{errors.length > 0 && <span className="rounded bg-white/25 px-1 text-[11px]">{errors.length}</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80 p-1">
                                <p className="px-2 pb-1 pt-2 text-sm font-semibold">{errors.length ? "Corrija antes de publicar" : "Avisos"}</p>
                                <IssuesList issues={issues} onPick={focusNode} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </header>

                {/* canvas */}
                <div ref={wrapper} className="relative flex-1 bg-[#F5F6F7] dark:bg-background">
                    <ReactFlow
                        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={isValidConnection}
                        onNodeClick={onNodeClick} onPaneClick={() => setPanelId(null)}
                        onNodesDelete={ds => ds.some(d => d.id === panelId) && setPanelId(null)}
                        deleteKeyCode={["Delete", "Backspace"]} multiSelectionKeyCode={["Shift", "Meta", "Control"]}
                        defaultEdgeOptions={{ type: "flow" }} connectionLineStyle={{ stroke: "var(--primary)", strokeWidth: 2.5, strokeDasharray: "8 3" }}
                        fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.15} maxZoom={1.75} proOptions={{ hideAttribution: true }}
                    >
                        <Background variant={BackgroundVariant.Lines} gap={50} color="rgba(100,116,139,0.10)" />
                    </ReactFlow>

                    {/* floating controls */}
                    <div className="absolute right-4 top-4 z-10 flex flex-col gap-3">
                        <Popover open={addOpen} onOpenChange={setAddOpen}>
                            <PopoverTrigger asChild>
                                <button type="button" title="Adicionar bloco" className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
                                    {addOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent side="left" align="start" className="w-56 p-1.5">
                                {ADDABLE_BLOCKS.map(t => {
                                    const Icon = BLOCK_ICONS[t];
                                    return (
                                        <button key={t} type="button" onClick={() => addBlock(t)} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[15px] hover:bg-muted">
                                            <Icon className="h-[18px] w-[18px]" style={{ color: BLOCKS[t].color }} />{BLOCKS[t].label}
                                        </button>
                                    );
                                })}
                            </PopoverContent>
                        </Popover>
                        <button type="button" title="Enquadrar todos os blocos" onClick={() => rf.fitView({ padding: 0.3, maxZoom: 1, duration: 300 })}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-[0_8px_12px_rgba(43,50,56,.08),0_0_2px_rgba(43,50,56,.24)] hover:bg-muted">
                            <Maximize className="h-[18px] w-[18px]" />
                        </button>
                    </div>

                    {panelNode && <BlockPanel key={panelNode.id} node={panelNode} onClose={() => setPanelId(null)} />}
                </div>
            </div>

            <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
                <AlertDialogContent className="sm:max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir bloco</AlertDialogTitle>
                        <AlertDialogDescription>O bloco e as conexões dele saem do rascunho. Dá para desfazer com Ctrl+Z enquanto a página estiver aberta.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => { if (toDelete) deleteNode(toDelete); setToDelete(null); }}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {dialog === "triggers" && <TriggersDialog open onOpenChange={o => setDialog(o ? "triggers" : null)} sessionId={sessionId} flowId={initial.id} initial={triggers} onSaved={setTriggers} />}
            {dialog === "test" && <TestDialog open onOpenChange={o => setDialog(o ? "test" : null)} onRun={runTest} />}
            {dialog === "settings" && <BotVarsDialog open onOpenChange={o => setDialog(o ? "settings" : null)} sessionId={sessionId} />}
            {dialog === "simulate" && <SimulatorSheet open onOpenChange={o => setDialog(o ? "simulate" : null)} sessionId={sessionId} flowId={initial.id} beforeSend={async () => {
                if (errors.length) { setIssuesOpen(true); toast.error("Corrija os erros antes de simular"); return false; }
                return saveNow();
            }} />}
            {dialog === "runs" && <RunsSheet open onOpenChange={o => setDialog(o ? "runs" : null)} sessionId={sessionId} flowId={initial.id} />}
        </EditorContext.Provider>
    );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
    if (state === "saving" || state === "dirty") return <span className="hidden items-center gap-1 text-[12px] text-muted-foreground sm:flex"><Loader2 className="h-3 w-3 animate-spin" />Salvando…</span>;
    if (state === "error") return <button type="button" onClick={onRetry} className="flex items-center gap-1 text-[12px] text-destructive"><CloudOff className="h-3.5 w-3.5" />Erro ao salvar · tentar de novo</button>;
    if (state === "conflict") return <span className="flex items-center gap-1 text-[12px] text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Alterado em outra aba</span>;
    return <span className="hidden items-center gap-1 text-[12px] text-muted-foreground sm:flex"><Check className="h-3.5 w-3.5" />Salvo</span>;
}

