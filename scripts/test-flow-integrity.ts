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
console.log("flow integrity: 8 regression scenarios passed (read-only, no WhatsApp).");
