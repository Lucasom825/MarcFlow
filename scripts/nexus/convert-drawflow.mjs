#!/usr/bin/env node
/** Convert a local Drawflow JSON into a non-production MarcFlow draft preview. */
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertDrawflowToMarcFlow } from './drawflow-converter.mjs';
const [, , input, output] = process.argv;
if (!input || !output || input === '--help' || input === '-h') {
  console.log('Uso: node scripts/nexus/convert-drawflow.mjs entrada.json saida-preview.json');
  process.exit(input === '--help' || input === '-h' ? 0 : 2);
}
try {
  const src = resolve(input), dest = resolve(output);
  if (src === dest || existsSync(dest)) throw new Error('Saída já existente ou igual à entrada: não sobrescrever.');
  if (statSync(src).size > 500_000) throw new Error('Entrada superior ao limite de 500 kB.');
  const r = convertDrawflowToMarcFlow(JSON.parse(readFileSync(src, 'utf8')));
  if (!r.ok) {
    console.error(JSON.stringify({ ok: false, issues: r.issues, warnings: r.warnings }, null, 2));
    process.exitCode = 1;
  } else {
    writeFileSync(dest, JSON.stringify(r, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log(`Prévia salva em ${dest}: ${r.graph.nodes.length} nós e ${r.graph.edges.length} conexões. Não foi publicada.`);
  }
} catch (e) { console.error('Conversão recusada:', e.message); process.exitCode = 2; }
