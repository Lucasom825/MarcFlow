/**
 * NEXUS 057 — explicit, fail-closed Drawflow -> MarcFlow draft graph converter.
 * This adapter does NOT run Drawflow JavaScript, execute nodes, save to a database,
 * publish a flow or contact WhatsApp. It only translates explicitly annotated JSON.
 * Based on jerosoler/Drawflow MIT, commit ef8a88cdfbf2010cc0b641b94278be6db413938b.
 */
const SCHEMA = 'nexus.marcflow.v1';
const MAX_NODES = 100;
const MAX_EDGES = 500;
const MAX_BYTES = 500_000;
const KEY = /^(?:input|output)_[1-9][0-9]*$/;
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const KNOWN = new Set(['start', 'content', 'action']);
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = (code, path, message) => ({ code, path, message });
const allUnique = ar => new Set(ar).size === ar.length;
const previewText = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 4000;

/** Returns a result with {ok,graph,issues,warnings,provenance}, never throws on bad data. */
export function convertDrawflowToMarcFlow(source) {
  const issues = [];
  const warnings = [];
  const add = (code, path, message) => { if (issues.length < 60) issues.push(fail(code, path, message)); };
  const warn = (code, path, message) => { if (warnings.length < 60) warnings.push(fail(code, path, message)); };
  const result = (graph = null) => ({
    ok: issues.length === 0,
    graph: issues.length ? null : graph,
    issues,
    warnings,
    provenance: {
      adapter: 'NEXUS 057',
      reference: 'jerosoler/Drawflow@ef8a88cdfbf2010cc0b641b94278be6db413938b',
      inputAuthenticityVerified: false,
      target: 'MarcFlow draft FlowGraph only',
      executedTargetCode: false,
      modifiedProduction: false,
    },
  });
  let raw;
  try { raw = JSON.stringify(source); } catch { add('JSON_INVALID', '$', 'O documento deve ser JSON puro.'); return result(); }
  if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_BYTES) {
    add('SIZE_LIMIT', '$', 'Entrada vazia ou superior a 500 kB.'); return result();
  }
  if (!record(source) || !record(source.drawflow) || !record(source.drawflow.Home) || !record(source.drawflow.Home.data)) {
    add('DRAWFLOW_SCHEMA', '$.drawflow.Home.data', 'Formato de exportação Drawflow Home esperado.'); return result();
  }
  const modules = Object.keys(source.drawflow);
  if (modules.some(k => k !== 'Home' && (!record(source.drawflow[k]) || !record(source.drawflow[k].data) || Object.keys(source.drawflow[k].data).length))) {
    add('MULTIPLE_MODULES', '$.drawflow', 'Módulos adicionais com dados exigem conversão e validação separadas.');
  }
  const entries = Object.entries(source.drawflow.Home.data);
  if (entries.length === 0 || entries.length > MAX_NODES) {
    add('NODE_COUNT', '$.drawflow.Home.data', 'Esperados 1 a 100 nós.'); return result();
  }
  const nodes = [];
  const byId = new Map();
  const original = new Map();
  const idList = [];
  for (const [key, node] of entries) {
    const path = `$.drawflow.Home.data[${JSON.stringify(key)}]`;
    if (!record(node) || !ID.test(key) || String(node.id) !== key) {
      add('NODE_ID', path, 'Chave e id do nó devem coincidir e conter apenas letras, números, _ e -.'); continue;
    }
    idList.push(key);
    if (!Number.isFinite(node.pos_x) || !Number.isFinite(node.pos_y) || Math.abs(node.pos_x) > 1e6 || Math.abs(node.pos_y) > 1e6) {
      add('POSITION', path, 'Posições devem ser números finitos e limitados.'); continue;
    }
    const spec = node.data?.nexus_marcflow;
    if (!record(spec) || spec.schema !== SCHEMA || !KNOWN.has(spec.type)) {
      add('EXPLICIT_MAPPING_REQUIRED', `${path}.data.nexus_marcflow`, 'Sem anotação explícita de tipo compatível; não inferir pela aparência ou HTML.'); continue;
    }
    if (!record(spec.payload) || !record(spec.outputHandles) || !record(node.inputs) || !record(node.outputs)) {
      add('NODE_SCHEMA', path, 'payload, portas de entrada/saída e outputHandles devem ser objetos.'); continue;
    }
    if (spec.type === 'start' && Object.keys(spec.payload).length !== 0) {
      add('START_PAYLOAD', path, 'Bloco inicial deve ter payload vazio.'); continue;
    }
    if (spec.type === 'content') {
      const items = spec.payload.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 20 || !items.every(x => record(x) && ID.test(x.id) && x.kind === 'text' && previewText(x.text)) || !allUnique(items.map(x => x.id))) {
        add('CONTENT_PAYLOAD', path, 'Somente 1–20 textos válidos e não duplicados são aceitos neste piloto.'); continue;
      }
    }
    if (spec.type === 'action' && (!Array.isArray(spec.payload.actions) || !spec.payload.actions.length || !spec.payload.actions.every(x => record(x) && ID.test(x.id) && x.type === 'resumeAutomation') || !allUnique(spec.payload.actions.map(x => x.id)))) {
      add('ACTION_NOT_SAFE', path, 'Somente resumeAutomation é mapeada; efeitos externos não são inferidos.'); continue;
    }
    const payload = spec.type === 'start' ? {} : spec.type === 'content' ?
      { items: spec.payload.items.map(i => ({ id: i.id, kind: 'text', text: i.text })) } :
      { actions: spec.payload.actions.map(i => ({ id: i.id, type: 'resumeAutomation' })) };
    const name = typeof spec.label === 'string' && spec.label.length <= 100 ? spec.label : undefined;
    const mapped = { id: `df_${key}`, type: spec.type,
      position: { x: Math.round(node.pos_x), y: Math.round(node.pos_y) },
      data: name ? { ...payload, name } : payload };
    nodes.push(mapped);
    byId.set(key, mapped);
    original.set(key, node);
    // HTML, classes, and unrecognized payload keys are deliberately discarded.
    if (node.html) warn('HTML_IGNORED', path + '.html', 'HTML arbitrário foi descartado, sem execução nem renderização.');
  }
  if (!allUnique(idList)) add('DUPLICATE_ID', '$.drawflow.Home.data', 'IDs duplicados.');
  if (nodes.filter(n => n.type === 'start').length !== 1) add('START_COUNT', '$.drawflow.Home.data', 'Exatamente um bloco inicial é obrigatório.');
  if (issues.length) return result();
  const edges = [];
  const used = new Set();
  for (const [key, node] of original) {
    const p = `$.drawflow.Home.data[${JSON.stringify(key)}]`;
    const handles = node.data.nexus_marcflow.outputHandles;
    const allowedHandles = new Set(['next']); // pilot mapping applies to start/content/action only
    for (const [port, o] of Object.entries(node.outputs)) {
      if (!KEY.test(port) || !port.startsWith('output_') || !record(o) || !Array.isArray(o.connections)) {
        add('OUTPUT_SCHEMA', `${p}.outputs.${port}`, 'Porta de saída malformada.'); continue;
      }
      if (!has(handles, port) || !allowedHandles.has(handles[port])) {
        add('OUTPUT_HANDLE', `${p}.data.nexus_marcflow.outputHandles.${port}`, 'Saída sem mapeamento explícito next.'); continue;
      }
      const handle = handles[port];
      for (const [i, link] of o.connections.entries()) {
        const lp = `${p}.outputs.${port}.connections[${i}]`;
        const targetKey = String(link?.node ?? '');
        if (!record(link) || !byId.has(targetKey) || !KEY.test(link.output || '') || !String(link.output).startsWith('input_')) {
          add('BROKEN_EDGE', lp, 'Destino inexistente ou porta de entrada malformada.'); continue;
        }
        const target = original.get(targetKey);
        const reverse = target.inputs[link.output]?.connections;
        if (!Array.isArray(reverse) || !reverse.some(r => String(r.node) === key && r.input === port)) {
          add('ASYMMETRIC_EDGE', lp, 'Conexão não aparece na porta de entrada correspondente.'); continue;
        }
        const outboundKey = `${key}:${handle}`;
        if (used.has(outboundKey)) { add('MULTIPLE_DESTINATIONS', lp, 'MarcFlow admite no máximo um destino por saída.'); continue; }
        used.add(outboundKey);
        edges.push({ id: `df_edge_${edges.length + 1}`, source: `df_${key}`, sourceHandle: handle, target: `df_${targetKey}` });
        if (edges.length > MAX_EDGES) { add('EDGE_COUNT', lp, 'Limite de 500 conexões ultrapassado.'); return result(); }
      }
    }
  }
  // Check that every declared reverse link has an outbound counterpart, not just vice versa.
  for (const [key, node] of original) {
    for (const [port, input] of Object.entries(node.inputs)) {
      if (!KEY.test(port) || !port.startsWith('input_') || !record(input) || !Array.isArray(input.connections)) {
        add('INPUT_SCHEMA', key + '.' + port, 'Porta de entrada malformada.'); continue;
      }
      for (const link of input.connections) {
        const from = original.get(String(link?.node));
        if (!from?.outputs?.[link?.input]?.connections?.some(x => String(x.node) === key && x.output === port)) {
          add('ASYMMETRIC_INPUT', key + '.' + port, 'Entrada aponta para conexão de saída inexistente.');
        }
      }
    }
  }
  if (!edges.some(e => e.source === nodes.find(n => n.type === 'start')?.id)) add('START_DISCONNECTED', '$.drawflow.Home.data', 'O bloco inicial precisa de uma conexão.');
  if (issues.length) return result();
  const reachable = new Set([nodes.find(n => n.type === 'start').id]);
  let before = -1;
  while (reachable.size !== before) {
    before = reachable.size;
    for (const e of edges) if (reachable.has(e.source)) reachable.add(e.target);
  }
  for (const n of nodes) if (!reachable.has(n.id)) warn('UNREACHABLE_NODE', n.id, 'Nó desconectado do início; requer revisão antes da publicação.');
  return result({ nodes, edges });
}
