// NEXUS 059: SSR integration with MarcFlow's real IssuesList component.
// No browser/editor mutations; browser-specific interactions are proven separately by the lab.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IssuesList } from '../../src/components/flows/flow-dialogs';
import { validateGraph, type FlowGraph } from '../../src/modules/flows/types';
import { convertDrawflowToMarcFlow } from './drawflow-converter.mjs';
import { verifyPreview } from './verify-preview.mjs';

const source = JSON.parse(readFileSync(new URL('./exemplo-drawflow-anotado.json', import.meta.url), 'utf-8'));
const preview = convertDrawflowToMarcFlow(source);
assert.equal(preview.ok, true);
const audit = verifyPreview(preview);
assert.equal(audit.graphContractValid, true);
assert.equal(audit.approvedForPublication, false, 'Structural approval cannot authorize publication.');
const graph = preview.graph as FlowGraph;
assert.equal(graph.nodes.length, 2);
assert.equal(graph.edges.length, 1);

const renderIssues = (g: FlowGraph) => renderToStaticMarkup(
  createElement(IssuesList, { issues: validateGraph(g), onPick: () => {} }),
);
const structurallyValid = renderIssues(graph);
assert.match(structurallyValid, /Tudo certo para publicar/);
assert.doesNotMatch(structurallyValid, /<button/);

const detached = { ...graph, edges: [{ ...graph.edges[0], target: 'missing' }] } as FlowGraph;
const detachedHtml = renderIssues(detached);
assert.match(detachedHtml, /conexão apontando para um bloco que não existe/);
assert.match(detachedHtml, /<button/);
assert.match(detachedHtml, /bg-destructive/);

const unreachable = { ...graph, nodes: [...graph.nodes, {
  id: 'isolated', type: 'content', position: { x: 900, y: 0 },
  data: { items: [{ id: 'note', kind: 'text', text: 'Sem conexão' }] }
}] } as FlowGraph;
const warningHtml = renderIssues(unreachable);
assert.match(warningHtml, /bloco não está ligado ao início/);
assert.match(warningHtml, /bg-amber-500/);

console.log('NEXUS_059_REAL_UI_SSR_INTEGRATION_PASS=true');
console.log('NEXUS_059_PUBLICATION_AUTHORIZED=false');
