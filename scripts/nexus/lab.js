// NEXUS 059 client: same-origin request to the local read-only lab, no writes.
const byId = id => document.getElementById(id);
const input = byId('json');
const status = byId('status');
const diagram = byId('diagram');
const empty = byId('empty');
const findings = byId('findings');
const download = byId('download');
let lastPreview = null;
const MAX_BYTES = 500_000;

function updateStatus(message, kind = 'idle') {
  status.textContent = message;
  status.dataset.kind = kind;
}
function resetVisual() {
  diagram.replaceChildren();
  diagram.hidden = true;
  empty.hidden = false;
  byId('node-count').textContent = '—';
  byId('edge-count').textContent = '—';
  byId('warning-count').textContent = '—';
  findings.replaceChildren();
  const li = document.createElement('li');
  li.textContent = 'Sem prévia validada.';
  findings.appendChild(li);
  download.disabled = true;
  lastPreview = null;
}
function setFindings(issues) {
  findings.replaceChildren();
  const all = issues.length ? issues : [{ code: 'VALID', message: 'Nenhuma incompatibilidade estrutural detectada.' }];
  for (const issue of all) {
    const li = document.createElement('li');
    li.textContent = issue.code + ': ' + issue.message;
    findings.appendChild(li);
  }
}
function renderGraph(graph) {
  diagram.replaceChildren();
  const ns = 'http://www.w3.org/2000/svg';
  const xs = graph.nodes.map(n => n.position.x);
  const ys = graph.nodes.map(n => n.position.y);
  const xmin = Math.min(...xs), ymin = Math.min(...ys);
  const dx = Math.max(1, Math.max(...xs) - xmin);
  const dy = Math.max(1, Math.max(...ys) - ymin);
  const scale = Math.min(1, 730 / dx, 470 / dy);
  const points = new Map(graph.nodes.map((n, i) => [n.id, {
    x: 28 + (n.position.x - xmin) * scale,
    y: 25 + (n.position.y - ymin) * scale
  }]));
  const maxX = Math.max(...[...points.values()].map(p => p.x));
  const maxY = Math.max(...[...points.values()].map(p => p.y));
  diagram.style.width = Math.ceil(Math.max(640, maxX + 260)) + 'px';
  diagram.style.height = Math.ceil(Math.max(310, maxY + 135)) + 'px';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'connections');
  svg.setAttribute('viewBox', '0 0 ' + parseInt(diagram.style.width) + ' ' + parseInt(diagram.style.height));
  svg.setAttribute('aria-label', 'Conexões entre blocos');
  for (const e of graph.edges) {
    const a = points.get(e.source), b = points.get(e.target);
    const path = document.createElementNS(ns, 'path');
    const x1 = a.x + 215, y1 = a.y + 42, x2 = b.x, y2 = b.y + 42;
    path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + 45) + ' ' + y1 + ', ' + (x2 - 45) + ' ' + y2 + ', ' + x2 + ' ' + y2);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#417ad1');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('data-edge', e.id);
    svg.appendChild(path);
  }
  diagram.appendChild(svg);
  for (const n of graph.nodes) {
    const pos = points.get(n.id);
    const el = document.createElement('article');
    el.className = 'node';
    el.dataset.node = n.id;
    el.dataset.type = n.type;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    const label = document.createElement('span'); label.className = 'node-type'; label.textContent = n.type;
    const name = document.createElement('strong'); name.textContent = n.data.name || n.id;
    const desc = document.createElement('p');
    desc.textContent = n.type === 'content' ? n.data.items.map(i => i.text).join('\n') :
      n.type === 'action' ? 'Ações permitidas: ' + n.data.actions.length : 'Ponto de início';
    el.append(label, name, desc);
    diagram.appendChild(el);
  }
  diagram.hidden = false;
  empty.hidden = true;
  byId('node-count').textContent = graph.nodes.length;
  byId('edge-count').textContent = graph.edges.length;
}

async function loadExample() {
  try {
    const r = await fetch('/fixture', { cache: 'no-store' });
    if (!r.ok) throw new Error('Exemplo indisponível.');
    input.value = await r.text();
    resetVisual();
    updateStatus('Exemplo carregado. Clique em Analisar e visualizar.');
  } catch { updateStatus('Não foi possível carregar o exemplo.', 'error'); }
}
async function analyze() {
  resetVisual();
  const source = input.value;
  if (new TextEncoder().encode(source).length > MAX_BYTES) {
    updateStatus('Entrada acima de 500 kB. Nenhuma análise realizada.', 'error'); return;
  }
  let parsed;
  try { parsed = JSON.parse(source); }
  catch { updateStatus('JSON inválido. Corrija o documento antes de continuar.', 'error'); return; }
  updateStatus('Validando a estrutura na bancada local...');
  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Lab': '1' },
      body: JSON.stringify(parsed)
    });
    if (!res.ok) throw new Error('Análise local indisponível (' + res.status + ').');
    const result = await res.json();
    const notices = [...(result.preview?.issues || []),
      ...(result.audit?.blockers || []),
      ...(result.preview?.warnings || []),
      ...(result.audit?.warnings || [])];
    setFindings(notices);
    byId('warning-count').textContent = notices.length;
    if (!result.safeToPreview || !result.preview?.graph) {
      updateStatus('Fluxo recusado. Consulte os diagnósticos; nada foi importado.', 'error');
      return;
    }
    lastPreview = result.preview;
    renderGraph(result.preview.graph);
    download.disabled = false;
    updateStatus('Prévia local válida. Não autorizada para publicação nem execução.', 'pass');
  } catch (e) {
    updateStatus('Falha na análise: ' + e.message, 'error');
  }
}
function clear() {
  input.value = '';
  resetVisual();
  updateStatus('Bancada limpa. Nenhuma alteração persistida.');
}
function exportJson() {
  if (!lastPreview) return;
  const blob = new Blob([JSON.stringify(lastPreview, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'nexus-059-preview.json';
  link.click();
  URL.revokeObjectURL(link.href);
}
byId('load-example').addEventListener('click', loadExample);
byId('analyze').addEventListener('click', analyze);
byId('clear').addEventListener('click', clear);
download.addEventListener('click', exportJson);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function awaitCondition(fn) {
  for (let i = 0; i < 90; i++) { if (fn()) return; await sleep(90); }
  throw new Error('O estado visual esperado não apareceu.');
}
async function e2e() {
  try {
    byId('load-example').click();
    await awaitCondition(() => input.value.includes('nexus.marcflow.v1'));
    byId('analyze').click();
    await awaitCondition(() => status.dataset.kind === 'pass');
    if (diagram.querySelectorAll('.node').length !== 2 || diagram.querySelectorAll('[data-edge]').length !== 1
        || download.disabled || byId('node-count').textContent !== '2') {
      throw new Error('A prévia gráfica inicial está incorreta.');
    }
    const original = JSON.parse(input.value);
    const attack = structuredClone(original);
    attack.drawflow.Home.data['2'].data.nexus_marcflow.payload.items[0].text =
      '<img src=x onerror="window.nexusXss=true"> Texto de teste';
    input.value = JSON.stringify(attack);
    byId('analyze').click();
    await awaitCondition(() => status.dataset.kind === 'pass');
    if (document.querySelector('.node img') || globalThis.nexusXss ||
        !diagram.textContent.includes('<img src=x onerror')) {
      throw new Error('A prevenção de HTML ativo falhou.');
    }
    const invalid = structuredClone(original);
    invalid.drawflow.Home.data['1'].data.nexus_marcflow.outputHandles.output_1 = 'notify';
    input.value = JSON.stringify(invalid);
    byId('analyze').click();
    await awaitCondition(() => status.dataset.kind === 'error');
    if (!download.disabled || diagram.querySelectorAll('.node').length !== 0 ||
        !findings.textContent.includes('OUTPUT_HANDLE')) {
      throw new Error('Uma entrada incompatível não foi bloqueada.');
    }
    byId('clear').click();
    if (input.value || !download.disabled || diagram.querySelectorAll('.node').length) {
      throw new Error('A limpeza local não foi completa.');
    }
    document.body.dataset.e2e = 'pass';
  } catch (e) {
    document.body.dataset.e2e = 'fail';
    updateStatus('Teste visual: ' + e.message, 'error');
  }
}

const params = new URLSearchParams(location.search);
if (params.has('e2e')) void e2e();
else if (params.has('example')) void loadExample().then(analyze);
