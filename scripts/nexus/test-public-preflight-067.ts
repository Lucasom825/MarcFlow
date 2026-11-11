import test from "node:test";
import assert from "node:assert/strict";
import { inspectPublicRepo, parsePublicRepository, fetchPublicGithub, PreflightError } from "../../src/lib/nexus-public-preflight";
import { allowNexusDemoApi } from "../../src/lib/nexus-demo-policy";

const sha = "a".repeat(40);
const fixtures = {
  metadata: { private:false, archived:false, size:201, default_branch:"main",
    description:"An audited synthetic repo", license:{spdx_id:"MIT"} },
  commit: {sha},
  tree: {truncated:false, tree:[
    {type:"blob",path:"package.json"}, {type:"blob",path:"lib/index.js"},
    {type:"blob",path:"lib/utils.js"}, {type:"blob",path:"test/spec.ts"},
    {type:"tree",path:"lib"},
  ]},
  manifest: {encoding:"base64", content:Buffer.from(JSON.stringify({
    name:"audited",scripts:{test:"echo don't execute"},dependencies:{foo:"^1.0.0"}
  })).toString("base64")},
};
function makeGet(options: Partial<typeof fixtures> = {}) {
  const all={...fixtures,...options}; const paths:string[]=[];
  const get = async (p:string) => {
    paths.push(p);
    if(p===" /nothere")throw Error("invalid");
    if(p==="/repos/acme/example")return all.metadata;
    if(p==="/repos/acme/example/commits/main")return all.commit;
    if(p==="/repos/acme/example/git/trees/"+sha+"?recursive=1")return all.tree;
    if(p==="/repos/acme/example/contents/package.json?ref="+sha)return all.manifest;
    throw new Error("UNEXPECTED_EXTERNAL_GET "+p);
  };
  return {get,paths};
}
test("accept only exact public GitHub repository URL or owner/repo",()=>{
  assert.deepEqual(parsePublicRepository("acme/example"),{owner:"acme",repo:"example"});
  assert.deepEqual(parsePublicRepository("https://github.com/acme/example"),{owner:"acme",repo:"example"});
  for(const input of [
    "", "https://github.com.evil.test/acme/example","https://github.com/acme/example?token=x",
    "https://github.com/acme/example/tree/main", "acme/example/extra",
    "../example", "acme/../example", "acme/.git", "http://github.com/acme/example",
    "https://github.com/acme/example#secrets", "https://github.com:443/acme/example",
  ]) assert.throws(()=>parsePublicRepository(input),PreflightError,input);
});
test("pinned read-only source preflight resolves commit, files, manifest without executing",async()=>{
  const {get,paths}=makeGet();
  const result=await inspectPublicRepo("https://github.com/acme/example",get);
  assert.equal(result.repository,"acme/example");
  assert.equal(result.pinned_sha,sha);
  assert.equal(result.javascript_files,2);
  assert.equal(result.typescript_files,1);
  assert.equal(result.license,"MIT");
  assert.equal(result.license_allowlisted_for_toolkit,true);
  assert.equal(result.entries,4);
  assert.equal(result.package_summary?.name,"audited");
  assert.deepEqual(result.package_summary?.scripts,["test"]);
  assert.ok(result.candidate_js_directories.includes("lib"));
  assert.deepEqual(paths,[
    "/repos/acme/example", "/repos/acme/example/commits/main",
    "/repos/acme/example/git/trees/"+sha+"?recursive=1",
    "/repos/acme/example/contents/package.json?ref="+sha,
  ]);
  assert.equal(result.status,"PREFLIGHT_ONLY");
});
test("private, archived, huge and truncated targets are refused",async()=>{
  for(const f of [
    {metadata:{...fixtures.metadata,private:true}},
    {metadata:{...fixtures.metadata,archived:true}},
    {metadata:{...fixtures.metadata,size:200000}},
    {commit:{sha:"main"}},
    {tree:{...fixtures.tree,truncated:true}},
  ]){
    const {get}=makeGet(f as Partial<typeof fixtures>);
    await assert.rejects(inspectPublicRepo("acme/example",get),PreflightError);
  }
});
test("unknown license blocks REA handoff, not invent licensing approval",async()=>{
  const {get}=makeGet({metadata:{...fixtures.metadata,license:null} as any});
  const r=await inspectPublicRepo("acme/example",get);
  assert.equal(r.license,"NÃO VERIFICADA");
  assert.equal(r.license_allowlisted_for_toolkit,false);
});
test("manifest is optional and corrupt content is marked incomplete",async()=>{
  const {get}=makeGet({manifest:{encoding:"base64",content:Buffer.from("not json").toString("base64")}});
  const r=await inspectPublicRepo("acme/example",get);
  assert.equal(r.package_summary,null);
  assert.equal(r.javascript_files,2);
});
test("only authenticated read-only preflight is exposed in demo allowlist",()=>{
  assert.equal(allowNexusDemoApi("/api/nexus/public-inspect","GET"),true);
  for(const m of ["POST","PUT","DELETE","PATCH"])assert.equal(allowNexusDemoApi("/api/nexus/public-inspect",m),false);
  for(const p of ["/api/nexus/public-inspect/execute","/api/nexus/rea/dispatch",
    "/api/github/token","/api/nexus/import","/api/flows/nexus_demo_session/a/publish"]){
    assert.equal(allowNexusDemoApi(p,"GET"),false);
    assert.equal(allowNexusDemoApi(p,"POST"),false);
  }
});
test("GitHub HTTP adapter never accepts a non-repository URL", async()=>{
  await assert.rejects(fetchPublicGithub("https://api.github.com/repos/acme/example"),PreflightError);
  await assert.rejects(fetchPublicGithub("/users/me"),PreflightError);
  await assert.rejects(fetchPublicGithub("/repos/acme/example/../../users/me"),PreflightError);
});
