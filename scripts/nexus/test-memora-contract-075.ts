import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  planMemoraTasks,sampleProposals075,sampleExisting075,validateSourceTask,
  summarizePlan075,type SourceTask,type RemoteTask
} from "../../src/lib/nexus-memora-contract-075";

test("synthetic fixtures demonstrate skip, conflict, propose without a write",()=>{
 const plan=planMemoraTasks(sampleProposals075,sampleExisting075);
 assert.equal(plan.creates,2);
 assert.equal(plan.skipped,1);
 assert.equal(plan.conflicts,1);
 assert.equal(plan.rejected,0);
 assert.equal(plan.writes_performed,0);
 assert.deepEqual(plan.actions.map(x=>x.status),[
   "SKIP_SAME","REVIEW_CONFLICT","PROPOSE_CREATE","PROPOSE_CREATE"
 ]);
 assert.equal(plan.actions[3].source.meeting_id,"meeting_demo_002");
});

test("same task name in another meeting is NOT treated as duplicate",()=>{
 const src:SourceTask={meeting_id:"another_meeting",task:"Confirmar prazo fictício"};
 const plan=planMemoraTasks([src],sampleExisting075);
 assert.equal(plan.actions[0].status,"PROPOSE_CREATE");
});

test("matching task status, owner or deadline differences force human review",()=>{
 const existing:RemoteTask={task_id:"task-1",meeting_id:"meeting-1",task:"Examinar orçamento",status:"OPEN"};
 for(const field of [{status:"DONE"},{responsible:"Pessoa fictícia"},{deadline:"2026-12-01"}]){
  const plan=planMemoraTasks([{meeting_id:"meeting-1",task:"Examinar orçamento",...field}],[existing]);
  assert.equal(plan.actions[0].status,"REVIEW_CONFLICT");
 }
});

test("same meeting same title with spaces/case is recognized conservatively",()=>{
 const actual:RemoteTask={task_id:"task-1",meeting_id:"meeting-1",task:"  Revisar  Ata "};
 const proposed:SourceTask={meeting_id:"meeting-1",task:"revisar ata"};
 const plan=planMemoraTasks([proposed],[actual]);
 assert.equal(plan.actions[0].status,"REVIEW_CONFLICT");
 // key matches, but different textual fields stay for manual verification
 assert.deepEqual(plan.actions[0].matching_task_ids,["task-1"]);
});

test("duplicate incoming or existing matches are never auto-resolved",()=>{
 const candidate:SourceTask={meeting_id:"meeting-1",task:"Assunto fictício"};
 assert.equal(planMemoraTasks([candidate,candidate],[]).conflicts,2);
 const existing:RemoteTask[]=[
  {task_id:"task-1",...candidate},{task_id:"task-2",...candidate}
 ];
 assert.equal(planMemoraTasks([candidate],existing).actions[0].status,"REVIEW_CONFLICT");
});

test("invalid records are rejected, existing invalid source rejects whole plan",()=>{
 const bad={meeting_id:"../../production",task:"A"} as SourceTask;
 assert.equal(validateSourceTask(bad),false);
 assert.equal(planMemoraTasks([bad],[]).rejected,1);
 assert.throws(()=>planMemoraTasks([sampleProposals075[0]],[{
   task_id:"bad",meeting_id:"../../production",task:"A"
 }]),/inválido/);
 assert.equal(planMemoraTasks([{meeting_id:"meeting_1",task:"\u0000bad"}],[]).rejected,1);
 assert.throws(()=>planMemoraTasks(Array.from({length:51},()=>sampleProposals075[0]),[]),/Limite/);
});

test("summary explicitly declares no real integration or writes",()=>{
 const s=summarizePlan075(planMemoraTasks(sampleProposals075,sampleExisting075));
 assert.match(s,/Operações de escrita executadas: ZERO/);
 assert.match(s,/Memora NÃO configurada/);
 assert.match(s,/dados inteiramente fictícios/);
});

test("all new files have no API calls, local persistence, or connector writes",()=>{
 const paths=[
 "src/lib/nexus-memora-contract-075.ts",
 "src/components/nexus/nexus-memora-contract-075.tsx",
 "src/app/dashboard/nexus/rea/memora-contract/page.tsx",
 ];
 for(const p of paths){
  const file=readFileSync(p,"utf8");
  assert.doesNotMatch(file,/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|PrismaClient/);
  assert.doesNotMatch(file,/dangerouslySetInnerHTML|new Function\(|eval\(/);
 }
 const component=readFileSync(paths[1],"utf8");
 assert.match(component,/planMemoraTasks\(sampleProposals075,sampleExisting075\)/);
 assert.match(component,/Nenhuma conta Memora foi selecionada/);
 assert.match(component,/Operações executadas no Memora: 0/);
});
