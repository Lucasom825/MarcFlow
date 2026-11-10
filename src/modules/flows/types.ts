// Shared by the editor (client) and the engine/API (server). Keep it free of server imports.

export type NodeType =
    | "start"
    | "content"
    | "menu"
    | "action"
    | "condition"
    | "randomizer"
    | "smartDelay"
    | "flowLink";

export type TimeUnit = "seconds" | "minutes" | "hours" | "days";
export type FieldScope = "CONTACT" | "BOT";
export type FieldType = "TEXT" | "NUMBER" | "DATE" | "DATETIME";

export type AnswerType =
    | "text" | "number" | "date" | "datetime" | "firstName" | "lastName" | "fullName"
    | "email" | "cpf" | "image" | "video" | "audio" | "file";

export type MediaKind = "image" | "video" | "audio" | "file";

export type ContentItem =
    | { id: string; kind: "text"; text: string }
    | { id: string; kind: MediaKind; assetId?: string; url?: string; caption?: string; fileName?: string }
    | { id: string; kind: "delay"; seconds: number; typing: boolean }
    | { id: string; kind: "autoOff"; seconds: number }
    | { id: string; kind: "vcard"; name: string; phone: string; org?: string }
    | {
        id: string; kind: "input"; question: string; answerType: AnswerType;
        fieldKey?: string; fieldScope?: FieldScope;
        expireValue: number; expireUnit: TimeUnit;
        errorMessage: string; maxAttempts: number;
    };

export interface MenuOption { id: string; text: string }
/** WhatsApp limits for a poll (Baileys can't send list/button messages from a regular account). */
export const POLL_MAX_OPTIONS = 12;
export const POLL_MAX_QUESTION = 255;

export interface MenuData {
    /** "number" (default) = numbered text; "poll" = WhatsApp poll, the contact taps the option */
    mode?: "number" | "poll";
    question: string;
    invalidText: string;
    maxErrors: number; // 0 = never take the error exit
    options: MenuOption[];
    expireValue: number;
    expireUnit: TimeUnit;
}

export type FlowAction =
    | { id: string; type: "addTag" | "removeTag"; labelId?: string }
    | { id: string; type: "setField"; fieldKey?: string; fieldScope?: FieldScope; value: string }
    | { id: string; type: "clearField"; fieldKey?: string; fieldScope?: FieldScope }
    | { id: string; type: "notify"; phones: string; message: string }
    | { id: string; type: "pauseAutomation"; forever: boolean; value: number; unit: TimeUnit }
    | { id: string; type: "resumeAutomation" }
    | { id: string; type: "optOut" };

export type ConditionSource = "tag" | "weekday" | "time" | "field";
export type ConditionOp =
    | "is" | "isNot" | "contains" | "notContains" | "startsWith" | "hasValue"
    | "containsAny"
    | "gt" | "gte" | "lt" | "lte" | "eq" | "neq"
    | "after" | "before" | "on";

export interface FlowCondition {
    id: string;
    source: ConditionSource;
    fieldKey?: string;      // source=field (system keys allowed too)
    fieldScope?: FieldScope;
    fieldType?: FieldType;
    op: ConditionOp;
    value: string;          // labelId | weekday 0-6 | "HH:MM" | text/number/date
}

export interface ConditionData { logic: "and" | "or"; conditions: FlowCondition[] }
export interface RandomizerOption { id: string; weight: number }
export interface RandomizerData { mode: "random" | "sequential"; options: RandomizerOption[] }
export interface SmartDelayData { mode: "duration" | "datetime"; value: number; unit: "minutes" | "hours" | "days"; datetime?: string }
export interface FlowLinkData { flowId?: string }

export interface NodeDataMap {
    start: Record<string, unknown>;
    content: { items: ContentItem[] };
    menu: MenuData;
    action: { actions: FlowAction[] };
    condition: ConditionData;
    randomizer: RandomizerData;
    smartDelay: SmartDelayData;
    flowLink: FlowLinkData;
}

/** Optional block name shown in the editor header (e.g. "BOAS_VINDAS"). The engine ignores it. */
export interface NodeMeta { name?: string }

export interface FlowNode<T extends NodeType = NodeType> {
    id: string;
    type: T;
    position: { x: number; y: number };
    data: NodeDataMap[T] & NodeMeta;
}

export interface FlowEdge { id: string; source: string; sourceHandle: string; target: string }
export interface FlowGraph { nodes: FlowNode[]; edges: FlowEdge[] }

export const BLOCKS: Record<NodeType, { label: string; color: string }> = {
    start: { label: "Bloco inicial", color: "#64748B" },
    content: { label: "Conteúdo", color: "#EC5858" },
    menu: { label: "Menu", color: "#683AC8" },
    action: { label: "Ação", color: "#F5B715" },
    condition: { label: "Condição", color: "#5175F5" },
    flowLink: { label: "Conexão de fluxo", color: "#3ABA38" },
    randomizer: { label: "Randomizador", color: "#1FBADC" },
    smartDelay: { label: "Atraso inteligente", color: "#F0875A" },
};

export const ADDABLE_BLOCKS: NodeType[] = ["content", "menu", "action", "condition", "flowLink", "randomizer", "smartDelay"];

export const ANSWER_TYPES: { value: AnswerType; label: string }[] = [
    { value: "text", label: "Texto" }, { value: "number", label: "Número" }, { value: "date", label: "Data" },
    { value: "datetime", label: "Data e hora" }, { value: "firstName", label: "Primeiro nome" },
    { value: "lastName", label: "Sobrenome" }, { value: "fullName", label: "Nome completo" },
    { value: "email", label: "E-mail" }, { value: "cpf", label: "CPF" }, { value: "image", label: "Imagem" },
    { value: "video", label: "Vídeo" }, { value: "audio", label: "Áudio" }, { value: "file", label: "Arquivo" },
];

export const SYSTEM_FIELDS: { key: string; label: string; type: FieldType }[] = [
    { key: "nome-completo", label: "Nome completo", type: "TEXT" },
    { key: "primeiro-nome", label: "Primeiro nome", type: "TEXT" },
    { key: "sobrenome", label: "Sobrenome", type: "TEXT" },
    { key: "telefone", label: "Telefone", type: "TEXT" },
    { key: "ddd", label: "DDD", type: "TEXT" },
    { key: "ultima-mensagem", label: "Última mensagem recebida", type: "TEXT" },
    { key: "agora", label: "Data e hora atual", type: "DATETIME" },
];

export const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptyGraph(): FlowGraph {
    return { nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 }, data: {} }], edges: [] };
}

export function defaultData<T extends NodeType>(type: T): NodeDataMap[T] {
    const d: { [K in NodeType]: NodeDataMap[K] } = {
        start: {},
        content: { items: [] },
        menu: { question: "", invalidText: "Opção inválida. Responda com o número de uma das opções.", maxErrors: 3, options: [], expireValue: 1, expireUnit: "days" },
        action: { actions: [] },
        condition: { logic: "or", conditions: [] },
        randomizer: { mode: "random", options: [] },
        smartDelay: { mode: "duration", value: 0, unit: "minutes" },
        flowLink: {},
    };
    return structuredClone(d[type]);
}

/** Output handles of a node, in display order. Handle ids are what edges store in sourceHandle. */
export function outputsOf(node: FlowNode): { id: string; label: string }[] {
    switch (node.type) {
        case "start": return [{ id: "next", label: "Início" }];
        case "content": {
            const outs: { id: string; label: string }[] = [];
            for (const it of (node.data as NodeDataMap["content"]).items) {
                if (it.kind === "input") {
                    outs.push({ id: `input:${it.id}:valid`, label: "Resposta válida" });
                    outs.push({ id: `input:${it.id}:timeout`, label: "Se não responder" });
                }
            }
            outs.push({ id: "next", label: "Próximo passo" });
            return outs;
        }
        case "menu": {
            const d = node.data as MenuData;
            return [
                ...d.options.map((o, i) => ({ id: `option:${o.id}`, label: `${i + 1}. ${o.text || "Resposta " + (i + 1)}` })),
                ...(d.maxErrors > 0 ? [{ id: "error", label: "Saída de erro" }] : []),
                { id: "timeout", label: "Se não responder" },
            ];
        }
        case "condition": return [{ id: "true", label: "Verdadeiro" }, { id: "false", label: "Falso" }];
        case "randomizer": return (node.data as RandomizerData).options.map((o, i) => ({ id: `option:${o.id}`, label: `Opção ${i + 1}` }));
        case "flowLink": return [];
        default: return [{ id: "next", label: "Próximo passo" }];
    }
}

export interface GraphIssue { nodeId?: string; level: "error" | "warning"; message: string }

/** Validation used by the editor and by publish/test. Errors block publishing; warnings don't. */
export function validateGraph(graph: FlowGraph): GraphIssue[] {
    const issues: GraphIssue[] = [];
    const ids = new Set(graph.nodes.map(n => n.id));
    const start = graph.nodes.find(n => n.type === "start");
    if (!start) return [{ level: "error", message: "O fluxo não tem bloco inicial." }];
    if (!graph.edges.some(e => e.source === start.id)) issues.push({ nodeId: start.id, level: "error", message: "Conecte o bloco inicial a outro bloco." });

    for (const n of graph.nodes) {
        const err = (message: string) => issues.push({ nodeId: n.id, level: "error", message: `${n.data.name || BLOCKS[n.type].label}: ${message}` });
        switch (n.type) {
            case "content": {
                const d = n.data as NodeDataMap["content"];
                if (!d.items.length) err("adicione pelo menos um item.");
                for (const it of d.items) {
                    if (it.kind === "text" && !it.text.trim()) err("há um texto vazio.");
                    if ((it.kind === "image" || it.kind === "video" || it.kind === "audio" || it.kind === "file") && !it.assetId && !it.url) err("há uma mídia sem arquivo.");
                    if (it.kind === "vcard" && (!it.name.trim() || !it.phone.trim())) err("o cartão de contato precisa de nome e telefone.");
                    if (it.kind === "input" && !it.question.trim()) err("a pergunta da captura está vazia.");
                    if (it.kind === "input" && !it.fieldKey) err("escolha o campo onde salvar a resposta.");
                }
                break;
            }
            case "menu": {
                const d = n.data as MenuData;
                if (!d.question.trim()) err("escreva a pergunta.");
                if (!d.options.length) err("adicione pelo menos uma resposta.");
                if (d.options.some(o => !o.text.trim())) err("há uma resposta vazia.");
                if (d.options.some(o => !graph.edges.some(e => e.source === n.id && e.sourceHandle === `option:${o.id}`))) err("há uma resposta sem caminho conectado.");
                if (d.mode === "poll") {
                    if (d.options.length > POLL_MAX_OPTIONS) err(`a enquete do WhatsApp aceita no máximo ${POLL_MAX_OPTIONS} respostas.`);
                    if (d.question.length > POLL_MAX_QUESTION) err(`a pergunta da enquete passa de ${POLL_MAX_QUESTION} caracteres.`);
                    const texts = d.options.map(o => o.text.trim().toLowerCase());
                    if (new Set(texts).size < texts.length) err("a enquete não pode ter duas respostas iguais.");
                }
                break;
            }
            case "action": {
                const d = n.data as NodeDataMap["action"];
                if (!d.actions.length) err("adicione pelo menos uma ação.");
                for (const a of d.actions) {
                    if ((a.type === "addTag" || a.type === "removeTag") && !a.labelId) err("escolha a etiqueta.");
                    if ((a.type === "setField" || a.type === "clearField") && !a.fieldKey) err("escolha o campo.");
                    if (a.type === "notify" && (!a.phones.trim() || !a.message.trim())) err("informe o número e a mensagem da notificação.");
                }
                break;
            }
            case "condition": {
                const d = n.data as ConditionData;
                if (!d.conditions.length) err("adicione pelo menos uma condição.");
                for (const c of d.conditions) {
                    if (c.op !== "hasValue" && !String(c.value ?? "").trim()) err("há uma condição sem valor.");
                    if (c.source === "field" && !c.fieldKey) err("há uma condição sem campo.");
                }
                break;
            }
            case "randomizer": {
                const d = n.data as RandomizerData;
                if (d.options.length < 2) err("adicione pelo menos duas opções.");
                if (d.mode === "random" && d.options.reduce((s, o) => s + (Number(o.weight) || 0), 0) !== 100) err("a soma dos percentuais deve ser 100%.");
                break;
            }
            case "smartDelay": {
                const d = n.data as SmartDelayData;
                if (d.mode === "duration") {
                    const days = d.unit === "days" ? d.value : d.unit === "hours" ? d.value / 24 : d.value / 1440;
                    if (!(d.value > 0)) err("defina a duração.");
                    if (days > 30) err("o máximo é 30 dias.");
                } else if (!d.datetime) err("escolha a data e a hora.");
                break;
            }
            case "flowLink":
                if (!(n.data as FlowLinkData).flowId) err("escolha o fluxo.");
                break;
        }
    }

    // A flow's output is deterministic only when its source handle exists and
    // points to one destination. The editor enforces this for new connections,
    // but imported/stale graphs may bypass the UI. Check before publishing.
    if (ids.size !== graph.nodes.length) {
        issues.push({ level: "error", message: "Há blocos com identificadores duplicados no fluxo." });
    }
    const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
    const edgeIds = new Set<string>();
    const usedOutputs = new Set<string>();
    for (const e of graph.edges) {
        if (edgeIds.has(e.id)) {
            issues.push({ level: "error", message: "Há conexões com identificadores duplicados." });
        }
        edgeIds.add(e.id);
        const source = nodeById.get(e.source);
        const target = nodeById.get(e.target);
        if (!source || !target) {
            issues.push({ level: "error", message: "Há uma conexão apontando para um bloco que não existe." });
            continue;
        }
        if (target.type === "start") {
            issues.push({ nodeId: target.id, level: "error", message: "O bloco inicial não pode receber conexões." });
        }
        const handle = typeof e.sourceHandle === "string" ? e.sourceHandle : "";
        if (!outputsOf(source).some(output => output.id === handle)) {
            issues.push({
                nodeId: source.id,
                level: "error",
                message: `${source.data.name || BLOCKS[source.type].label}: conexão usa uma saída inexistente ou desatualizada.`,
            });
        }
        // Length-prefixed tuple prevents collisions with user-defined ids that
        // may contain separators such as ':', '|', or '/'.
        const outputKey = `${e.source.length}:${e.source}${handle.length}:${handle}`;
        if (usedOutputs.has(outputKey)) {
            issues.push({
                nodeId: source.id,
                level: "error",
                message: `${source.data.name || BLOCKS[source.type].label}: a mesma saída está conectada a mais de um destino.`,
            });
        }
        usedOutputs.add(outputKey);
    }

    // Reachability warning
    const reach = new Set<string>([start.id]);
    const queue = [start.id];
    while (queue.length) {
        const id = queue.shift()!;
        for (const e of graph.edges) if (e.source === id && !reach.has(e.target)) { reach.add(e.target); queue.push(e.target); }
    }
    for (const n of graph.nodes) if (!reach.has(n.id)) issues.push({ nodeId: n.id, level: "warning", message: `${n.data.name || BLOCKS[n.type].label}: bloco não está ligado ao início.` });
    return issues;
}
