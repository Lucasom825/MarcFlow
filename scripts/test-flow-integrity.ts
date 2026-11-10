// Fase Nexus 049: regression proof for graph integrity checks before publishing.
// Run without database, network, or WhatsApp: npx tsx scripts/test-flow-integrity.ts
import assert from "node:assert/strict";
import { validateGraph, type FlowGraph, type FlowNode } from "../src/modules/flows/types";

const point = { x: 0, y: 0 };
const start: FlowNode = { id: "start", type: "start", position: point, data: {} };
const content: FlowNode = {
    id: "content", type: "content", position: point,
    data: { items: [{ id: "txt", kind: "text", text: "Olá!" }] },
};
const action: FlowNode = {
    id: "action", type: "action", position: point,
    data: { actions: [{ id: "resume", type: "resumeAutomation" }] },
};
const healthy: FlowGraph = {
    nodes: [start, content, action],
    edges: [
        { id: "e-start", source: "start", sourceHandle: "next", target: "content" },
        { id: "e-content", source: "content", sourceHandle: "next", target: "action" },
    ],
};
const check = (graph: FlowGraph) => validateGraph(graph).filter(i => i.level === "error");
const has = (graph: FlowGraph, expression: RegExp) =>
    check(graph).some(issue => expression.test(issue.message));

assert.deepEqual(check(healthy), [], "Fluxo válido deve continuar publicável");

assert.ok(has({
    ...healthy, edges: [...healthy.edges, { id: "double", source: "start", sourceHandle: "next", target: "action" }],
}, /mesma saída.*mais de um destino/), "A saída não pode apontar para dois destinos");

assert.ok(has({
    ...healthy, edges: [...healthy.edges, { id: "bad-handle", source: "content", sourceHandle: "option:removed", target: "action" }],
}, /saída inexistente ou desatualizada/), "Saída de menu removida/desatualizada deve ser sinalizada");

assert.ok(has({
    ...healthy, edges: [...healthy.edges, { id: "bad-target", source: "action", sourceHandle: "next", target: "missing" }],
}, /bloco que não existe/), "Referência inexistente deve continuar sendo erro");

assert.ok(has({
    ...healthy, edges: [...healthy.edges, { id: "e-start", source: "action", sourceHandle: "next", target: "content" }],
}, /identificadores duplicados/), "IDs de aresta duplicados devem ser detectados");

assert.ok(has({
    ...healthy, nodes: [...healthy.nodes, { ...action, data: { actions: [{ id: "another", type: "resumeAutomation" }] } }],
}, /blocos com identificadores duplicados/), "IDs de nós duplicados devem ser detectados");

assert.ok(has({
    ...healthy, edges: [...healthy.edges, { id: "back", source: "action", sourceHandle: "next", target: "start" }],
}, /bloco inicial não pode receber/), "Start não pode ser alvo de uma conexão");

assert.ok(has({
    ...healthy, edges: [{ ...healthy.edges[0], sourceHandle: undefined as unknown as string }, healthy.edges[1]],
}, /saída inexistente ou desatualizada/), "JSON importado com handle ausente não deve provocar exceção");

const branch: FlowNode = {
    id: "condition", type: "condition", position: point,
    data: { logic: "or", conditions: [{ id: "exists", source: "tag", op: "is", value: "vip" }] },
};
const twoOutputs: FlowGraph = {
    nodes: [start, branch, content, action],
    edges: [
        { id: "start-branch", source: "start", sourceHandle: "next", target: "condition" },
        { id: "if-yes", source: "condition", sourceHandle: "true", target: "content" },
        { id: "if-no", source: "condition", sourceHandle: "false", target: "action" },
    ],
};
assert.deepEqual(check(twoOutputs), [], "Saídas diferentes de condição continuam válidas");
// Compatibility: formerly valid graph snapshots, including cycles intentionally
// used by the engine's runaway-loop safety test, must remain valid when their
// source outputs are unique and correctly named.
const intentionalLoop: FlowGraph = {
    nodes: [start, action],
    edges: [
        { id: "loop-in", source: "start", sourceHandle: "next", target: "action" },
        { id: "loop-edge", source: "action", sourceHandle: "next", target: "action" },
    ],
};
assert.deepEqual(check(intentionalLoop), [], "Legacy self-loop structurally valid; runtime keeps its own cycle guard");

// The same source handle can be used independently on distinct source nodes.
assert.deepEqual(check(twoOutputs), [], "The two condition handles remain independent");

// Optional exits (timeout/error) do not require a connection.
const menu: FlowNode = {
    id: "menu", type: "menu", position: point,
    data: { question: "Escolha", invalidText: "Inválido", maxErrors: 3,
        options: [{ id: "a", text: "Preço" }], expireValue: 1, expireUnit: "days" },
};
const legacyMenu: FlowGraph = {
    nodes: [start, menu, content],
    edges: [
        { id: "start-menu", source: "start", sourceHandle: "next", target: "menu" },
        { id: "menu-option", source: "menu", sourceHandle: "option:a", target: "content" },
    ],
};
assert.deepEqual(check(legacyMenu), [], "Valid menu without timeout and error exits stays publishable");

// A stale menu option must fail instead of silently routing nowhere.
assert.ok(has({
    ...legacyMenu,
    nodes: [start, { ...menu, data: { ...menu.data, options: [{ id: "b", text: "Novo" }] } }, content],
}, /saída inexistente ou desatualizada/), "Reconfigured menus cannot keep an old option handle");

// A named source node may have a valid single output even when it is isolated,
// and reachability must remain a warning rather than an error.
const unconnectedAction = { ...action, id: "standalone" };
assert.deepEqual(check({ ...healthy, nodes: [...healthy.nodes, unconnectedAction] }), [], "Orphan nodes remain warnings");

// The API publisher and editor must keep using the SAME validator contract.
// This check is source-level (not browser automation) and does not touch DB.
import { readFileSync } from "node:fs";
const publishApi = readFileSync("src/app/api/flows/[sessionId]/[flowId]/publish/route.ts", "utf8");
const editorSource = readFileSync("src/components/flows/flow-editor.tsx", "utf8");
assert.match(publishApi, /validateGraph\(graph\)/);
assert.match(editorSource, /validateGraph\(graph\)/);
assert.match(editorSource, /sourceHandle: e\.sourceHandle \|\| "next"/);

console.log("flow integrity: 13 graph/legacy cases + editor/API validation contract passed.");
