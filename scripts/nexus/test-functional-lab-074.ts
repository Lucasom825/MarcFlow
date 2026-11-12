import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  applyLabAction,filteredLabTasks,initialLabState,labCounts,
  normalizeLabTitle,snapshotLabTasks,MAX_LAB_TASKS,type LabState
} from "../../src/lib/nexus-functional-lab-074";

test("original synthetic state contains no user-specific information",()=>{
 assert.equal(initialLabState.tasks.length,2);
 assert.ok(initialLabState.tasks.every(t=>t.id.startsWith("demo-")));
 assert.equal(labCounts(initialLabState).total,2);
 assert.equal(labCounts(initialLabState).open,1);
 assert.equal(labCounts(initialLabState).done,1);
});

test("create trims valid description, assigns deterministic ID, preserves old state",()=>{
 const before=initialLabState;
 const after=applyLabAction(before,{type:"create",title:"  Rever nota fictícia  "});
 assert.equal(after.tasks.length,3);
 assert.deepEqual(after.tasks[2],{id:"demo-3",title:"Rever nota fictícia",completed:false});
 assert.equal(after.nextId,4);
 assert.equal(before.tasks.length,2);
 assert.equal(before.nextId,3);
 assert.equal(after.lastError,null);
});

test("empty, overlong, controls and non-newline invalid descriptions are rejected",()=>{
 for(const bad of ["","   ","x".repeat(121),"Valid\nInvalid","bad\u0000text"]){
   assert.equal(normalizeLabTitle(bad),null);
   const result=applyLabAction(initialLabState,{type:"create",title:bad});
   assert.equal(result.tasks.length,2);
   assert.match(result.lastError??"",/válida/);
 }
 assert.equal(normalizeLabTitle("  Boa tarefa  "),"Boa tarefa");
});

test("complete then reopen and filter each group",()=>{
 const created=applyLabAction(initialLabState,{type:"create",title:"FUP demonstrativo"});
 const done=applyLabAction(created,{type:"toggle",id:"demo-3"});
 assert.equal(done.tasks[2].completed,true);
 assert.equal(labCounts(done).done,2);
 assert.equal(filteredLabTasks(done,"all").length,3);
 assert.equal(filteredLabTasks(done,"done").length,2);
 assert.equal(filteredLabTasks(done,"open").length,1);
 const reopened=applyLabAction(done,{type:"toggle",id:"demo-3"});
 assert.equal(reopened.tasks[2].completed,false);
 assert.equal(labCounts(reopened).open,2);
 assert.equal(created.tasks[2].completed,false);
});

test("rename changes only selected task; invalid rename keeps its original title",()=>{
 const done=applyLabAction(initialLabState,{type:"rename",id:"demo-1",title:"  Novo texto fictício  "});
 assert.equal(done.tasks[0].title,"Novo texto fictício");
 assert.equal(done.tasks[1].title,initialLabState.tasks[1].title);
 const invalid=applyLabAction(done,{type:"rename",id:"demo-1",title:"  "});
 assert.equal(invalid.tasks[0].title,"Novo texto fictício");
 assert.match(invalid.lastError??"",/edição/);
});

test("unknown task ID performs no accidental edit or mutation",()=>{
 assert.strictEqual(applyLabAction(initialLabState,{type:"toggle",id:"not-found"}),initialLabState);
 assert.strictEqual(applyLabAction(initialLabState,{type:"rename",id:"not-found",title:"another"}),initialLabState);
});

test("bounded demo capacity disallows unbounded additions",()=>{
 let state:LabState=initialLabState;
 for(let i=state.tasks.length;i<MAX_LAB_TASKS;i++){
   state=applyLabAction(state,{type:"create",title:"Tarefa fictícia "+i});
 }
 assert.equal(state.tasks.length,MAX_LAB_TASKS);
 const rejected=applyLabAction(state,{type:"create",title:"NÃO ENTRA"});
 assert.equal(rejected.tasks.length,MAX_LAB_TASKS);
 assert.match(rejected.lastError??"",/Limite/);
});

test("explicit snapshot is synthetic and has no hidden server persistence metadata",()=>{
 const s=snapshotLabTasks(initialLabState);
 const data=JSON.parse(s);
 assert.equal(data.schema,"NEXUS_074_SYNTHETIC_TASKS_V1");
 assert.equal(data.sample_only,true);
 assert.equal(data.production_integration,false);
 assert.deepEqual(data.tasks,initialLabState.tasks);
 assert.equal(data.api_token,undefined);
 assert.equal(data.user_id,undefined);
});

test("page and component are isolated from any API mutation or browser storage",()=>{
 const page=readFileSync("src/app/dashboard/nexus/rea/lab/page.tsx","utf8");
 const component=readFileSync("src/components/nexus/rea-functional-lab-074.tsx","utf8");
 const lib=readFileSync("src/lib/nexus-functional-lab-074.ts","utf8");
 const nav=readFileSync("src/app/dashboard/nexus/rea/reuse/page.tsx","utf8");
 assert.match(page,/ReaFunctionalLab074/);
 assert.match(nav,/dashboard\/nexus\/rea\/lab/);
 assert.match(component,/useReducer\(applyLabAction,initialLabState\)/);
 assert.match(component,/onClick=\{\(\)=>void copy\(\)\}/);
 assert.match(component,/Não digite informações privadas/);
 assert.doesNotMatch(component,/dangerouslySetInnerHTML|eval\(|new Function\(/);
 for(const code of [lib,page,component]){
   assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket/);
   assert.doesNotMatch(code,/PrismaClient|executeCommand|execSync|spawnSync/);
 }
});
