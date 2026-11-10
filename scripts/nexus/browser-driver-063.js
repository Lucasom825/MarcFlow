// NEXUS 063 browser driver — injected ONLY in a throwaway GitHub Actions runner.
// Exercises the ORIGINAL login form, ORIGINAL dashboard flow page, and real cookie/session.
// Never adds an API key, never mocks a fetch response, never calls publish/test/WhatsApp.
(() => {
  if (!location.hostname || location.hostname !== "127.0.0.1" || location.port !== "39163") return;
  const S = "nexus063_browser_state";
  const F = "/dashboard/flows/nexus063_owner_flow";
  const OWNER = "owner063@example.invalid";
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(predicate, label, attempts = 220) {
    for (let i = 0; i < attempts; i++) {
      const outcome = await predicate();
      if (outcome) return outcome;
      await wait(125);
    }
    throw new Error("Timeout while waiting for " + label);
  }
  function setInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", {bubbles:true}));
    input.dispatchEvent(new Event("change", {bubbles:true}));
  }
  async function asJson(path) {
    const response=await fetch(path,{cache:"no-store",credentials:"same-origin"});
    let json={};try{json=await response.json()}catch{}
    return {status:response.status,json};
  }
  function pass(data) {
    document.documentElement.dataset.nexus063="pass";
    for(const [key,value] of Object.entries(data)) document.documentElement.dataset["nexus063"+key]=String(value);
  }
  function fail(e) {
    document.documentElement.dataset.nexus063="fail";
    document.documentElement.dataset.nexus063Error=String(e?.message||e).slice(0,250);
  }

  async function login() {
    const mode = new URLSearchParams(location.search).get("nexus063") || "owner";
    if(!["owner","other"].includes(mode)) throw Error("Unrecognized test role");
    sessionStorage.setItem("nexus063-role",mode);
    const state=sessionStorage.getItem(S);
    if(state==="auth-submit") throw Error("Returned to login after submitting credentials");
    sessionStorage.setItem(S,"auth-submit");
    const fields=await until(()=>{
      const email=document.querySelector('input[name="email"]');
      const password=document.querySelector('input[name="password"]');
      const submit=document.querySelector('button[type="submit"]');
      return email&&password&&submit?{email,password,submit}:null;
    },"real login form");
    const emailValue=mode==="owner"?OWNER:"other063@example.invalid";
    const passwordValue=mode==="owner"?"nexus063-owner-disposable-password":"nexus063-other-disposable-password";
    // Give the real Next.js client time to hydrate and attach React Hook Form handlers.
    await wait(1700);
    for(let attempt=0;attempt<3;attempt++){
      fields.email.focus();
      setInput(fields.email,emailValue);
      await wait(100);
      fields.password.focus();
      setInput(fields.password,passwordValue);
      fields.password.blur();
      await wait(200);
      if(fields.email.value!==emailValue||fields.password.value!==passwordValue)
        throw Error("Hydrated login controls rejected synthetic typing");
      if(fields.submit.disabled) throw Error("Original login submit disabled");
      fields.submit.click();
      await wait(950);
      if(location.pathname!=="/auth/login")return;
      // React Hook Form may have reset fields if a synthetic event raced hydration.
      const validation=document.querySelector('[data-slot="form-message"]')?.textContent||"";
      if(!validation)break;
    }
    if(location.pathname==="/auth/login" &&
       (document.body.textContent||"").includes("E-mail ou senha inválidos"))
      throw Error("Real NextAuth rejected synthetic credentials");
    if(location.pathname==="/auth/login" &&
       document.querySelector('[data-slot="form-message"]'))
      throw Error("Original login form validation did not accept synthetic input");
  }

  async function ownerDashboard() {
    const state=sessionStorage.getItem(S);
    const auth=await until(async()=>{
      const s=await asJson("/api/auth/session");
      return s.status===200 && s.json?.user?.email===OWNER ? s : null;
    },"authenticated JWT session cookie");
    if(!auth.json?.user?.id) throw Error("Auth user id missing");
    if(document.cookie.includes("authjs.session-token")||document.cookie.includes("__Secure-authjs.session-token"))
      throw Error("Session token unexpectedly accessible to JavaScript");
    await until(()=>document.querySelectorAll(".react-flow__node").length>=2,"original dashboard editor nodes");
    const initial=await asJson("/api/flows/nexus063_owner_session/nexus063_owner_flow");
    if(initial.status!==200)throw Error("Cookie authorization failed for original flow GET: "+initial.status);
    if(state!=="after-reload"){
      if(initial.json.data?.draftGraph?.nodes?.length!==2||initial.json.data?.draftRevision!==0)
        throw Error("Unexpected initial state for owner");
      const button=document.querySelector('button[title="Adicionar bloco"]');
      if(!button)throw Error("Original editor Add block action absent");
      button.click();
      const add=await until(()=>Array.from(document.querySelectorAll("button"))
        .find(b=>b.textContent?.trim()==="Conteúdo"),"original content block menu");
      add.click();
      await until(()=>document.querySelectorAll(".react-flow__node").length===3,"original third node");
      const saved=await until(async()=>{
        const r=await asJson("/api/flows/nexus063_owner_session/nexus063_owner_flow");
        if(r.status!==200)throw Error("Cannot read saved draft through cookie");
        return r.json.data?.draftGraph?.nodes?.length===3 && r.json.data.draftRevision>=1?r.json.data:null;
      },"real database autosave");
      if(saved.draftGraph.edges.length!==1||saved.status!=="DRAFT"||saved.publishedGraph!==null)
        throw Error("Draft connection/status lost on cookie save");
      sessionStorage.setItem(S,"after-reload");
      location.reload();
      return;
    }
    await until(()=>document.querySelectorAll(".react-flow__node").length===3,"three restored nodes after reload");
    const persisted=await asJson("/api/flows/nexus063_owner_session/nexus063_owner_flow");
    if(persisted.status!==200||persisted.json.data?.draftGraph?.nodes?.length!==3
      ||persisted.json.data?.draftGraph?.edges?.length!==1
      ||persisted.json.data?.draftRevision<1
      ||persisted.json.data?.publishedGraph!==null
      ||persisted.json.data?.status!=="DRAFT")throw Error("Cookie browser reload disagrees with stored graph");
    pass({Role:"owner",Nodes:3,Edges:1,Revision:persisted.json.data.draftRevision,
      Cookie:"httponly",Auth:"credentials-jwt",Published:"false"});
  }

  async function otherDashboard() {
    await until(async()=>{
      const r=await asJson("/api/auth/session");
      return r.status===200&&r.json?.user?.email==="other063@example.invalid";
    },"second user cookie session");
    const cross=await asJson("/api/flows/nexus063_owner_session/nexus063_owner_flow");
    if(cross.status!==403)throw Error("Cross-user access should be 403, got "+cross.status);
    const own=await asJson("/api/flows/nexus063_other_session/nexus063_other_flow");
    if(own.status!==200||own.json.data?.draftRevision!==0)throw Error("Other user's own data inaccessible");
    await until(()=>document.body?.textContent?.includes("Fluxo não encontrado"),"real dashboard denies inaccessible flow");
    if(document.querySelectorAll(".react-flow__node").length!==0)throw Error("Unauthorized flow rendered in editor");
    pass({Role:"other",Unauthorized:403,OwnFlow:200,OwnerNodes:0});
  }

  function run() {
    if(location.pathname==="/auth/login") return login();
    if(location.pathname===F) return sessionStorage.getItem("nexus063-role")==="other"
      ?otherDashboard():ownerDashboard();
  }
  const start=()=>{Promise.resolve(run()).catch(fail)};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
