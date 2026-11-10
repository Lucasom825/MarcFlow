#!/usr/bin/env node
// NEXUS 058: check a Drawflow preview against the real MarcFlow validator.
// No flow execution, database, WhatsApp, or publication.
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../../src/modules/flows/types.ts', import.meta.url);
const VALIDATOR_FILE = process.env.NEXUS_VALIDATOR_PATH
  ? pathToFileURL(resolve(process.env.NEXUS_VALIDATOR_PATH)).href : ROOT.href;
const { validateGraph, outputsOf } = await import(VALIDATOR_FILE);
const MAX_BYTES = 500_000;
const ID = /^[A-Za-z0-9_-]{1,90}$/;
const TYPES = new Set(['start', 'content', 'action']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const item = (code, message, path = '$') => ({ code, path, message });

export function verifyPreview(preview) {
  const blockers = [];
  const warnings = [];
  const error = (code, message, path = '$') => { if (blockers.length < 50) blockers.push(item(code, message, path)); };
  const warn = (code, message, path = '$') => { if (warnings.length < 50) warnings.push(item(code, message, path)); };
  const report = () => ({
    approvedForPublication: false,
    graphContractValid: blockers.length === 0,
    blockers, warnings,
    status: blockers.length ? 'INCOMPATIBLE' : 'LOCAL_GRAPH_CONTRACT_VALID',
    targetValidator: 'MarcFlow validateGraph (loaded from repository source)',
    authenticityVerified: false,
    executedSourceApp: false,
    databaseChanged: false,
    whatsappSent: false,
  });
  if (!isRecord(preview) || preview.ok !== true || !isRecord(preview.graph)
      || !Array.isArray(preview.issues) || preview.issues.length > 0) {
    error('PREVIEW_REJECTED', 'Entrada deve ser uma prévia 057 bem-sucedida, sem erros anteriores.');
    return report();
  }
  if (preview.provenance?.adapter !== 'NEXUS 057'
      || preview.provenance?.reference !== 'jerosoler/Drawflow@ef8a88cdfbf2010cc0b641b94278be6db413938b') {
    error('PROVENANCE_MISMATCH', 'Origem declarada difere do contrato experimental fixado.');
    return report();
  }
  warn('PROVENANCE_UNAUTHENTICATED', 'A identificação no JSON é autodeclarada, não uma assinatura de origem.');
  const { nodes, edges } = preview.graph;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || nodes.length < 2 || nodes.length > 100 || edges.length > 500) {
    error('GRAPH_SIZE', 'Esperado grafo com 2–100 nós e até 500 conexões.');
    return report();
  }
  const nodeIds = new Set();
  for (const [i, n] of nodes.entries()) {
    const p = '$.graph.nodes[' + i + ']';
    if (!isRecord(n) || !ID.test(n.id) || !TYPES.has(n.type) || !isRecord(n.data)
        || !isRecord(n.position) || !Number.isFinite(n.position.x) || !Number.isFinite(n.position.y)
        || Math.abs(n.position.x) > 1_000_000 || Math.abs(n.position.y) > 1_000_000) {
      error('NODE_SCHEMA', 'Nó inválido, sem ID/tipo/dados/posição suportados.', p);
      continue;
    }
    if (nodeIds.has(n.id)) error('NODE_DUPLICATE', 'Há dois nós com o mesmo ID.', p);
    nodeIds.add(n.id);
    if (n.type === 'start' && Object.keys(n.data).some(k => k !== 'name')) error('START_DATA', 'Bloco inicial não aceita conteúdo.', p);
    if (n.type === 'content' && (!Array.isArray(n.data.items) || !n.data.items.length
       || n.data.items.some(it => !isRecord(it) || !ID.test(it.id) || it.kind !== 'text' || typeof it.text !== 'string' || !it.text.trim()))) {
      error('CONTENT_SCHEMA', 'Somente mensagens de texto completas são admitidas.', p);
    }
    if (n.type === 'action' && (!Array.isArray(n.data.actions) || !n.data.actions.length
       || n.data.actions.some(a => !isRecord(a) || !ID.test(a.id) || a.type !== 'resumeAutomation'))) {
      error('ACTION_SCHEMA', 'Ação não suportada na homologação experimental.', p);
    }
  }
  if (blockers.length) return report();
  if (nodes.filter(n => n.type === 'start').length !== 1) error('START_COUNT', 'Exatamente um bloco inicial é exigido.');
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edgeIds = new Set();
  const occupied = new Set();
  for (const [i, e] of edges.entries()) {
    const p = '$.graph.edges[' + i + ']';
    if (!isRecord(e) || !ID.test(e.id) || typeof e.source !== 'string' || typeof e.target !== 'string'
        || typeof e.sourceHandle !== 'string' || !byId.has(e.source) || !byId.has(e.target)) {
      error('EDGE_SCHEMA', 'Conexão malformada ou apontando para nó inexistente.', p);
      continue;
    }
    if (edgeIds.has(e.id)) error('EDGE_DUPLICATE', 'ID de conexão repetido.', p);
    edgeIds.add(e.id);
    const src = byId.get(e.source);
    if (!outputsOf(src).some(h => h.id === e.sourceHandle)) error('STALE_OUTPUT', 'A saída do nó não existe no MarcFlow.', p);
    if (byId.get(e.target).type === 'start') error('EDGE_TO_START', 'Não é permitido conectar ao bloco inicial.', p);
    const outputKey = JSON.stringify([e.source, e.sourceHandle]);
    if (occupied.has(outputKey)) error('FANOUT', 'A mesma saída tem destinos múltiplos.', p);
    occupied.add(outputKey);
  }
  if (blockers.length) return report();
  let issues;
  try { issues = validateGraph(preview.graph); }
  catch (e) { error('VALIDATOR_EXCEPTION', 'A validação real não conseguiu processar o grafo.'); return report(); }
  for (const issue of issues) {
    if (issue.level === 'error') error('MARCFLOW_ERROR', issue.message, issue.nodeId || '$.graph');
    else warn('MARCFLOW_WARNING', issue.message, issue.nodeId || '$.graph');
  }
  return report();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const input = process.argv[2];
  if (!input || input.startsWith('-')) {
    console.error('Uso: node --experimental-strip-types scripts/nexus/verify-preview.mjs preview.json');
    process.exitCode = 2;
  } else {
    try {
      if (statSync(input).size > MAX_BYTES) throw new Error('Prévia superior a 500 kB.');
      const result = verifyPreview(JSON.parse(readFileSync(input, 'utf8')));
      console.log(JSON.stringify(result, null, 2));
      if (!result.graphContractValid) process.exitCode = 1;
    } catch (e) { console.error('Verificação recusada:', e.message); process.exitCode = 2; }
  }
}
