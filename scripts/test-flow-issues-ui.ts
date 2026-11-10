// Integration smoke for the real UI component used in the flow editor.
// Does not need a browser, WhatsApp, a database, or secret environment values.
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IssuesList } from "../src/components/flows/flow-dialogs";
import { validateGraph, type FlowGraph } from "../src/modules/flows/types";

const position = { x: 0, y: 0 };
const graph: FlowGraph = {
    nodes: [
        { id: "start", type: "start", position, data: {} },
        { id: "content", type: "content", position, data: { items: [{ id: "text", kind: "text", text: "Olá" }] } },
        { id: "action", type: "action", position, data: { actions: [{ id: "resume", type: "resumeAutomation" }] } },
    ],
    edges: [
        { id: "start-route", source: "start", sourceHandle: "next", target: "content" },
        { id: "content-route", source: "content", sourceHandle: "next", target: "action" },
    ],
};
const htmlFor = (g: FlowGraph) => renderToStaticMarkup(
    createElement(IssuesList, { issues: validateGraph(g), onPick: () => {} }),
);

const validHtml = htmlFor(graph);
assert.match(validHtml, /Tudo certo para publicar/);
assert.doesNotMatch(validHtml, /<button/);

const invalidHtml = htmlFor({
    ...graph,
    edges: [...graph.edges, { id: "duplicate", source: "start", sourceHandle: "next", target: "action" }],
});
assert.match(invalidHtml, /a mesma saída está conectada a mais de um destino/);
assert.match(invalidHtml, /<button/);
assert.doesNotMatch(invalidHtml, /Tudo certo para publicar/);
assert.match(invalidHtml, /bg-destructive/);

const staleHtml = htmlFor({
    ...graph,
    edges: [{ ...graph.edges[0], sourceHandle: "option:removed" }, graph.edges[1]],
});
assert.match(staleHtml, /conexão usa uma saída inexistente ou desatualizada/);

const warningGraph: FlowGraph = {
    ...graph,
    nodes: [...graph.nodes, {
        id: "orphan", type: "action", position,
        data: { actions: [{ id: "resume2", type: "resumeAutomation" }] },
    }],
};
const warningHtml = htmlFor(warningGraph);
assert.match(warningHtml, /bloco não está ligado ao início/);
assert.match(warningHtml, /bg-amber-500/);
assert.doesNotMatch(warningHtml, /bg-destructive/);

console.log("flow editor UI: IssuesList renders valid, duplicate-route, stale-handle and warning feedback.");
