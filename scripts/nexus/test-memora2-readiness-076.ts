import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  parseMemora2Recent076,syntheticMemora2Recent076,
  summarizeMemora2Readiness076,classifyMemora2Meeting076,
} from "../../src/lib/nexus-memora2-readiness-076";

test("real Memora 2 recent-summary shape is mapped with explicit uncertainty",()=>{
 const data=parseMemora2Recent076(syntheticMemora2Recent076);
 assert.equal(data.items.length,4);
 assert.equal(data.invalid_records,0);
 assert.equal(data.source_scope,"SYNTHETIC");
 assert.equal(data.writes_performed,0);
 assert.equal(data.full_inventory_verified,false);
 assert.deepEqual(data.items.map(x=>x.readiness),[
  "PDF_PRESENT_NOT_VALIDATED","IN_PROGRESS","ERROR_REVIEW","PROCESSED_WITHOUT_PDF"
 ]);
 assert.deepEqual(summarizeMemora2Readiness076(data),{
  pdf_present:1,processed_without_pdf:1,in_progress:1,review:1,invalid:0
 });
 for(const row of data.items){
   assert.equal(row.audio_verified,false);
   assert.equal(row.transcript_verified,false);
   assert.equal(row.minutes_quality_verified,false);
 }
});

test("unsafe details from API are intentionally not represented",()=>{
 const result=parseMemora2Recent076([{
   ...syntheticMemora2Recent076[0],
   originalName:"Reunião confidencial e nome completo",
   error:"AUTH_SECRET=must-not-leak",
   audioKey:"meetings/private/audio",
   ownerUserId:"person-private",
 }]);
 const serialized=JSON.stringify(result);
 assert.doesNotMatch(serialized,/Reunião confidencial|AUTH_SECRET|audioKey|ownerUserId|originalName|person-private/);
});

test("cannot interpret a PROCESSED flag as a quality-verified PDF",()=>{
 const d=syntheticMemora2Recent076[0];
 assert.equal(classifyMemora2Meeting076({...d,source:"recorded",status:"PROCESSED",createdAt:d.createdAt as string,pdfVersion:1,hasSavedPdf:true,id:"test-a"}),"PDF_PRESENT_NOT_VALIDATED");
 assert.equal(classifyMemora2Meeting076({...d,source:"recorded",status:"PROCESSED",createdAt:d.createdAt as string,pdfVersion:1,hasSavedPdf:false,id:"test-b"}),"PROCESSED_WITHOUT_PDF");
});

test("invalid statuses, dates, IDs, duplicates and overlong payloads are rejected",()=>{
 const valid=syntheticMemora2Recent076[0];
 const bad=[
  {...valid,id:"../secrets"},
  {...valid,status:"READY_TO_USE"},
  {...valid,source:"other"},
  {...valid,createdAt:"invalid-date"},
  {...valid,pdfVersion:0},
  {...valid,hasSavedPdf:"true"},
  {...valid,id:"x".repeat(129)},
 ];
 const result=parseMemora2Recent076([valid,...bad]);
 assert.equal(result.items.length,1);
 assert.equal(result.invalid_records,7);
 assert.equal(parseMemora2Recent076([valid,valid]).invalid_records,1);
 assert.throws(()=>parseMemora2Recent076({items:[]}),/Lista inválida/);
 assert.throws(()=>parseMemora2Recent076(Array.from({length:9},()=>valid)),/Lista inválida/);
});

test("only state-specific READINESS is inferred, and no hidden network access",()=>{
 const paths=[
  "src/lib/nexus-memora2-readiness-076.ts",
  "src/components/nexus/memora2-readiness-076.tsx",
  "src/app/dashboard/nexus/rea/memora2-readiness/page.tsx"
 ];
 for(const path of paths){
  const src=readFileSync(path,"utf8");
  assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket|PrismaClient/);
  assert.doesNotMatch(src,/dangerouslySetInnerHTML|eval\(|new Function\(/);
  assert.doesNotMatch(src,/Authorization:|Bearer\s|token=|cookie:/i);
 }
 const view=readFileSync(paths[1],"utf8");
 assert.match(view,/Não conectado ao Memora 2/);
 assert.match(view,/Operações de escrita realizadas:/);
 assert.match(view,/PDF presente não comprova fidelidade da ata/);
 const route=readFileSync("src/app/dashboard/nexus/rea/memora-contract/page.tsx","utf8");
 assert.match(route,/dashboard\/nexus\/rea\/memora2-readiness/);
});
