"use client";
// NEXUS 062 - mounts unchanged MarcFlow FlowEditor against REAL Next HTTP + MySQL.
// This module is reachable only through a throwaway route created inside CI.
// No API response mocking. Only adds a disposable synthetic API key on same-origin requests.
import { useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowEditor, type LoadedFlow } from "../../src/components/flows/flow-editor";
import type { FlowMeta } from "../../src/components/flows/editor-context";

const SESSION = "nexus062_test_session";
const FLOW = "nexus062_test_flow";
const KEY = "nexus062_owner_key_disposable_not_secret";
const PHASE = "nexus062_realhttp_phase";
const URL_FLOW = `/api/flows/${SESSION}/${FLOW}`;
const URL_DRAFT = `${URL_FLOW}/draft`;
const META: FlowMeta = { labels: [], fields: [], systemFields: [], flows: [] };
const MAX_POLL = 135;

type Snapshot = LoadedFlow;
function pause(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitUntil(predicate: () => boolean | Promise<boolean>, label: string) {
  for (let i = 0; i < MAX_POLL; i++) {
    if (await predicate()) return;
    await pause(125);
  }
  throw new Error(`Expected ${label} but it never appeared`);
}

export default function FullStackNexus062() {
  const [flow, setFlow] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(0);
  const e2eStarted = useRef(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_NEXUS062_LAB !== "true") {
      setError("Laboratório indisponível fora do runner de teste.");
      return;
    }
    const previousFetch = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString(), location.origin);
      const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.origin !== location.origin) {
        setBlocked(v => v + 1);
        return Promise.resolve(new Response(JSON.stringify({message:"External origin refused"}), { status: 403 }));
      }
      if (url.pathname.startsWith("/api/")) {
        const allowed = (url.pathname === URL_FLOW && method === "GET")
          || (url.pathname === URL_DRAFT && method === "PUT");
        if (!allowed) {
          setBlocked(v => v + 1);
          return Promise.resolve(new Response(JSON.stringify({message:"Unapproved API call refused"}), { status: 403 }));
        }
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        headers.set("x-api-key", KEY); // disposable key, validated by production authentication logic
        return previousFetch.call(window, input, { ...init, headers, cache: "no-store" });
      }
      return previousFetch.call(window, input, init);
    };

    let alive = true;
    window.fetch(URL_FLOW, { cache: "no-store" }).then(async res => {
      const json = await res.json();
      if (!res.ok) throw new Error(`Actual GET rejected (${res.status}): ${json.message || json.error}`);
      if (!alive) return;
      setFlow(json.data as LoadedFlow);
    }).catch(e => alive && setError(String(e.message || e)));
    return () => { alive = false; window.fetch = previousFetch; };
  }, []);

  useEffect(() => {
    if (!flow || !new URLSearchParams(location.search).has("e2e") || e2eStarted.current) return;
    e2eStarted.current = true;
    void (async () => {
      try {
        await waitUntil(() => document.querySelectorAll(".react-flow__node").length >= 2, "original React Flow mounted");
        const phase = sessionStorage.getItem(PHASE) || "initial";
        const getSaved = async (): Promise<Snapshot> => {
          const res = await fetch(URL_FLOW, {cache:"no-store"});
          if (!res.ok) throw new Error(`Real GET failed ${res.status}`);
          return (await res.json()).data as Snapshot;
        };
        if (phase === "initial") {
          if (flow.draftGraph.nodes.length !== 2 || flow.draftGraph.edges.length !== 1 || flow.draftRevision !== 0)
            throw new Error("Unexpected DB initial graph");
          const addTrigger = document.querySelector('button[title="Adicionar bloco"]') as HTMLButtonElement | null;
          if (!addTrigger) throw new Error("Original editor Add block control missing");
          addTrigger.click();
          await waitUntil(() => Array.from(document.querySelectorAll("button"))
            .some(el => el.textContent?.trim() === "Conteúdo"), "original Add content button");
          const add = Array.from(document.querySelectorAll("button"))
            .find(el => el.textContent?.trim() === "Conteúdo") as HTMLButtonElement;
          add.click();
          await waitUntil(() => document.querySelectorAll(".react-flow__node").length === 3,
            "third node in real editor");
          let persisted: Snapshot | null = null;
          await waitUntil(async () => {
            const current = await getSaved();
            if (current.draftRevision < 1 || current.draftGraph.nodes.length !== 3) return false;
            persisted = current;
            return true;
          }, "HTTP PUT committed to real MySQL");
          if (!persisted || persisted.draftGraph.edges.length !== 1
              || !persisted.draftGraph.edges.some(e => e.source === "df_1" && e.target === "df_2"))
            throw new Error("Original connection was not preserved");
          if (persisted.status !== "DRAFT" || persisted.publishedGraph !== null)
            throw new Error("Draft test caused unexpected publication");
          await waitUntil(() => !!Array.from(document.querySelectorAll("span")).find(el => el.textContent === "Salvo"),
            "real editor saved indicator");
          sessionStorage.setItem(PHASE, "after-reload");
          location.reload();
          return;
        }
        if (phase !== "after-reload") throw new Error("Unexpected test phase");
        await waitUntil(() => document.querySelectorAll(".react-flow__node").length === 3,
          "three restored React Flow nodes");
        const persisted = await getSaved();
        if (flow.draftRevision !== persisted.draftRevision
            || flow.draftGraph.nodes.length !== 3 || flow.draftGraph.edges.length !== 1
            || persisted.draftGraph.nodes.length !== 3 || persisted.draftGraph.edges.length !== 1
            || persisted.draftRevision < 1) throw new Error("HTTP/DB reload mismatch");
        if (persisted.status !== "DRAFT" || persisted.publishedGraph !== null)
          throw new Error("Published or activated unexpectedly");
        if (blocked > 0) throw new Error("Extra API or external call attempted");
        document.documentElement.dataset.nexus062 = "pass";
        document.documentElement.dataset.nexus062Nodes = String(persisted.draftGraph.nodes.length);
        document.documentElement.dataset.nexus062Edges = String(persisted.draftGraph.edges.length);
        document.documentElement.dataset.nexus062Revision = String(persisted.draftRevision);
        document.documentElement.dataset.nexus062Realhttp = "yes";
        document.documentElement.dataset.nexus062Published = "false";
      } catch (e) {
        document.documentElement.dataset.nexus062 = "fail";
        document.documentElement.dataset.nexus062Error = e instanceof Error ? e.message : String(e);
      }
    })();
  }, [flow, blocked]);

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"8px 16px",fontFamily:"system-ui",fontSize:12,background:"#e7f0fc",color:"#153555"}}>
        <strong>NEXUS 062 — EDITOR REAL + API HTTP + MYSQL REAL DESCARTÁVEL</strong>
        {" · " }Sem publicação · Sem WhatsApp · Banco apenas neste CI
        {" · "}Bloqueios de API externa: <span id="nexus062-blocked">{blocked}</span>
      </div>
      {error ? <p role="alert">{error}</p> : !flow
        ? <p>Carregando do MySQL via API autenticada…</p>
        : <div style={{minHeight:600,flex:1,padding:16}}>
          <ReactFlowProvider>
            <FlowEditor sessionId={SESSION} initial={flow} initialMeta={META} />
          </ReactFlowProvider>
        </div>}
    </div>
  );
}
