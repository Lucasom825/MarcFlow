import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyPreview } from './verify-preview.mjs';
import { convertDrawflowToMarcFlow } from './drawflow-converter.mjs';

const source = JSON.parse(readFileSync(new URL('./exemplo-drawflow-anotado.json', import.meta.url), 'utf8'));
const clone = x => structuredClone(x);
const fixture = () => convertDrawflowToMarcFlow(clone(source));
const valid = () => { const p=fixture(); assert.equal(p.ok,true); return p; };
const rejects = (p,code) => {const r=verifyPreview(p);assert.equal(r.graphContractValid,false,JSON.stringify(r));assert.ok(r.blockers.some(x=>x.code===code),JSON.stringify(r));};

test('fixture Drawflow annotated maps to actual MarcFlow validator',()=>{
  const p=valid(),r=verifyPreview(p);assert.equal(r.graphContractValid,true,JSON.stringify(r));
  assert.equal(r.status,'LOCAL_GRAPH_CONTRACT_VALID');assert.equal(r.approvedForPublication,false);
  assert.equal(p.graph.nodes.length,2);assert.equal(p.graph.edges.length,1);
});
test('no runtime side effects or origin verification are claimed',()=>{
  const r=verifyPreview(valid());assert.equal(r.whatsappSent,false);assert.equal(r.databaseChanged,false);
  assert.equal(r.authenticityVerified,false);assert.equal(r.executedSourceApp,false);
  assert.ok(r.warnings.some(x=>x.code==='PROVENANCE_UNAUTHENTICATED'));
});
test('refuse forged successful envelope with prior errors',()=>{const p=valid();p.issues=[{code:'bad'}];rejects(p,'PREVIEW_REJECTED')});
test('refuse mutated reference even when graph is valid',()=>{const p=valid();p.provenance.reference='fake';rejects(p,'PROVENANCE_MISMATCH')});
test('refuse duplicated node IDs',()=>{const p=valid();p.graph.nodes[1].id=p.graph.nodes[0].id;rejects(p,'NODE_DUPLICATE')});
test('refuse missing target of a valid-looking connection',()=>{const p=valid();p.graph.edges[0].target='deleted';rejects(p,'EDGE_SCHEMA')});
test('refuse output absent from MarcFlow actual block contract',()=>{const p=valid();p.graph.edges[0].sourceHandle='option:deleted';rejects(p,'STALE_OUTPUT')});
test('refuse incoming connection to start',()=>{const p=valid();p.graph.edges.push({id:'e2',source:'df_2',sourceHandle:'next',target:'df_1'});rejects(p,'EDGE_TO_START')});
test('refuse duplicate output fanout',()=>{const p=valid();p.graph.edges.push({id:'e2',source:'df_1',sourceHandle:'next',target:'df_2'});rejects(p,'FANOUT')});
test('refuse duplicate edge IDs',()=>{const p=valid();p.graph.edges.push({...p.graph.edges[0]});rejects(p,'EDGE_DUPLICATE')});
test('refuse unsupported type before calling actual validator',()=>{const p=valid();p.graph.nodes[1].type='menu';rejects(p,'NODE_SCHEMA')});
test('refuse incomplete node data before calling actual validator',()=>{const p=valid();delete p.graph.nodes[1].data.items;rejects(p,'CONTENT_SCHEMA')});
test('refuse additional unapproved external action',()=>{const p=valid();p.graph.nodes[1].type='action';p.graph.nodes[1].data={actions:[{id:'x',type:'notify',phones:'111'}]};rejects(p,'ACTION_SCHEMA')});
test('real validator catches start without onward route',()=>{const p=valid();p.graph.edges=[];rejects(p,'MARCFLOW_ERROR')});
test('unreachable content is advisory, not silently discarded',()=>{
  const p=valid();p.graph.nodes.push({id:'df_3',type:'content',position:{x:700,y:200},data:{items:[{id:'text3',kind:'text',text:'Sem ligação'}]}});
  const r=verifyPreview(p);assert.equal(r.graphContractValid,true,JSON.stringify(r));assert.ok(r.warnings.some(x=>x.code==='MARCFLOW_WARNING'));
});
test('round trip leaves Drawflow input unchanged',()=>{const s=clone(source);const b=JSON.stringify(s);const p=convertDrawflowToMarcFlow(s);verifyPreview(p);assert.equal(JSON.stringify(s),b)});
test('malformed or extremely large preview is refused',()=>{const p=valid();p.graph.nodes=Array.from({length:101},()=>p.graph.nodes[0]);rejects(p,'GRAPH_SIZE')});
