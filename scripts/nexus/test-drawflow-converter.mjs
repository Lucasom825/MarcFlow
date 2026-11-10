import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertDrawflowToMarcFlow } from './drawflow-converter.mjs';
const annotate = (type, payload, label = undefined) => ({
  nexus_marcflow: { schema: 'nexus.marcflow.v1', type, payload, outputHandles: { output_1: 'next' }, ...(label ? { label } : {}) },
});
const base = () => ({ drawflow: { Home: { data: {
  1: { id: 1, name: 'inicio', pos_x: 10, pos_y: 20, data: annotate('start', {}), html: '<img src=x onerror=alert(1)>', inputs: {}, outputs: {output_1: { connections: [{node:'2',output:'input_1'}]}} },
  2: { id: 2, name: 'mensagem', pos_x: 300, pos_y: 120, data: annotate('content', { items:[{id:'a',kind:'text',text:'Olá!'}] }, 'Boas-vindas'), html: '<script>bad()</script>', inputs: {input_1: { connections: [{node:'1',input:'output_1'}] } }, outputs: {output_1: { connections: [] }} },
}}}});
const error = (b, code) => {const r=convertDrawflowToMarcFlow(b);assert.equal(r.ok,false);assert.ok(r.issues.some(x=>x.code===code),JSON.stringify(r.issues));};

test('real Drawflow serialized schema: two nodes, one edge, correctly mapped',()=>{
 const r=convertDrawflowToMarcFlow(base()); assert.equal(r.ok,true,JSON.stringify(r.issues));
 assert.equal(r.graph.nodes.length,2); assert.equal(r.graph.edges.length,1);
 assert.deepEqual(r.graph.edges[0],{id:'df_edge_1',source:'df_1',sourceHandle:'next',target:'df_2'});
 assert.equal(r.graph.nodes[1].data.name,'Boas-vindas');
 assert.equal(r.graph.nodes[1].data.items[0].text,'Olá!');
 assert.equal(r.provenance.inputAuthenticityVerified,false);
});
test('dangerous HTML is not copied to MarcFlow output',()=>{
 const r=convertDrawflowToMarcFlow(base());assert.equal(r.ok,true);
 assert.ok(r.warnings.some(i=>i.code==='HTML_IGNORED'));assert.doesNotMatch(JSON.stringify(r.graph),/script|onerror/);
});
test('refuse absent explicit schema mapping',()=>{const b=base();delete b.drawflow.Home.data[2].data.nexus_marcflow;error(b,'EXPLICIT_MAPPING_REQUIRED')});
test('refuse missing incoming reciprocal edge',()=>{const b=base();b.drawflow.Home.data[2].inputs.input_1.connections=[];error(b,'ASYMMETRIC_EDGE')});
test('refuse missing outbound reciprocal edge',()=>{const b=base();b.drawflow.Home.data[1].outputs.output_1.connections=[];error(b,'ASYMMETRIC_INPUT')});
test('refuse stale target node',()=>{const b=base();b.drawflow.Home.data[1].outputs.output_1.connections[0].node='999';error(b,'BROKEN_EDGE')});
test('refuse output handle not explicitly mapped',()=>{const b=base();b.drawflow.Home.data[1].data.nexus_marcflow.outputHandles={};error(b,'OUTPUT_HANDLE')});
test('refuse two targets for one MarcFlow next output',()=>{const b=base();b.drawflow.Home.data[1].outputs.output_1.connections.push({node:'2',output:'input_1'});error(b,'MULTIPLE_DESTINATIONS')});
test('refuse unsupported node type without guessing',()=>{const b=base();b.drawflow.Home.data[2].data.nexus_marcflow.type='menu';error(b,'EXPLICIT_MAPPING_REQUIRED')});
test('refuse action effects other than resumeAutomation',()=>{const b=base();b.drawflow.Home.data[2].data=annotate('action',{actions:[{id:'a',type:'notify',phones:'123',message:'test'}]});error(b,'ACTION_NOT_SAFE')});
test('refuse duplicate original id and map key',()=>{const b=base();b.drawflow.Home.data[2].id=1;error(b,'NODE_ID')});
test('refuse extra module with data',()=>{const b=base();b.drawflow.Second={data:{x:{}}};error(b,'MULTIPLE_MODULES')});
test('refuse non-finite coordinates',()=>{const b=base();b.drawflow.Home.data[2].pos_x=Infinity;error(b,'POSITION')});
test('refuse start disconnected',()=>{const b=base();b.drawflow.Home.data[1].outputs.output_1.connections=[];b.drawflow.Home.data[2].inputs.input_1.connections=[];error(b,'START_DISCONNECTED')});
test('report unreachable nodes instead of dropping them',()=>{const b=base();b.drawflow.Home.data[3]={id:3,name:'isolated',data:annotate('content',{items:[{id:'x',kind:'text',text:'Isolado'}]}),pos_x:900,pos_y:20,inputs:{},outputs:{output_1:{connections:[]}}};const r=convertDrawflowToMarcFlow(b);assert.equal(r.ok,true);assert.ok(r.warnings.some(x=>x.code==='UNREACHABLE_NODE'));});
test('no mutation of input',()=>{const b=base();const before=JSON.stringify(b);convertDrawflowToMarcFlow(b);assert.equal(JSON.stringify(b),before)});
test('refuse missing source structure',()=>error({hello:true},'DRAWFLOW_SCHEMA'));
test('refuse content without text',()=>{const b=base();b.drawflow.Home.data[2].data.nexus_marcflow.payload.items=[];error(b,'CONTENT_PAYLOAD')});
