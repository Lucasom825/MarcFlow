"use client";

import {useReducer,useState,type FormEvent} from "react";
import {CheckCircle2,ClipboardCopy,FlaskConical,ShieldAlert} from "lucide-react";
import {
  applyLabAction,filteredLabTasks,initialLabState,labCounts,MAX_LAB_TASKS,
  MAX_LAB_TITLE,snapshotLabTasks,type LabFilter
} from "@/lib/nexus-functional-lab-074";

const filters:{id:LabFilter;label:string}[]=[
  {id:"all",label:"Todas"},
  {id:"open",label:"Pendentes"},
  {id:"done",label:"Concluídas"},
];

/** Temporary browser memory ONLY. No calls to any server or storage APIs. */
export function ReaFunctionalLab074(){
  const [state,dispatch]=useReducer(applyLabAction,initialLabState);
  const [title,setTitle]=useState("");
  const [filter,setFilter]=useState<LabFilter>("all");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editingTitle,setEditingTitle]=useState("");
  const [copyMessage,setCopyMessage]=useState("");
  const stats=labCounts(state);
  const visible=filteredLabTasks(state,filter);

  function create(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!title.trim())return;
    dispatch({type:"create",title});
    setTitle("");
    setCopyMessage("");
  }
  function submitEdit(e:FormEvent<HTMLFormElement>,id:string){
    e.preventDefault();
    if(!editingTitle.trim())return;
    dispatch({type:"rename",id,title:editingTitle});
    setEditingId(null);setEditingTitle("");
    setCopyMessage("");
  }
  async function copy(){
    try{
      await navigator.clipboard.writeText(snapshotLabTasks(state));
      setCopyMessage("JSON demonstrativo copiado localmente. Nada foi enviado ao servidor.");
    }catch{
      setCopyMessage("Cópia indisponível no navegador. Nenhum dado foi enviado.");
    }
  }

  return <section className="space-y-5 rounded-2xl border bg-card p-5" aria-label="Laboratório funcional NEXUS 074">
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
        <FlaskConical className="h-4 w-4"/> NEXUS 074 — primeiro teste comportamental isolado
      </p>
      <h2 className="text-xl font-bold">Pendências fictícias de reunião</h2>
      <p className="text-sm text-muted-foreground">
        Protótipo independente para demonstrar criar, editar, concluir e filtrar pendências.
        Não utiliza código do Express ou TodoMVC e não se conecta ao Memora.
      </p>
    </div>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4"/> Somente demonstração</p>
      <p>Os itens são fictícios e ficam apenas na memória desta página. Ao recarregar, o estado volta aos exemplos iniciais.
        Não digite informações privadas ou tarefas reais.</p>
    </div>
    <form onSubmit={create} className="space-y-2">
      <label htmlFor="rea074-add" className="block text-sm font-semibold">Nova pendência fictícia</label>
      <div className="flex flex-wrap gap-2">
        <input id="rea074-add" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
          value={title} maxLength={MAX_LAB_TITLE} onChange={e=>setTitle(e.target.value)}
          placeholder="Ex.: confirmar responsável demonstrativo" />
        <button type="submit" disabled={!title.trim()||stats.total>=MAX_LAB_TASKS}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Adicionar
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Máximo {MAX_LAB_TASKS} itens; sem banco de dados, integrações ou automações.</p>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <span><strong>{stats.total}</strong> totais</span>
        <span><strong>{stats.open}</strong> pendentes</span>
        <span><strong>{stats.done}</strong> concluídas</span>
      </div>
      <div role="group" aria-label="Filtrar pendências fictícias" className="flex flex-wrap gap-2">
        {filters.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id}
          onClick={()=>setFilter(f.id)}
          className={"rounded-lg border px-3 py-2 text-xs "+(filter===f.id?"bg-emerald-50 font-semibold text-emerald-900":"text-muted-foreground")}>
          {f.label}
        </button>)}
      </div>
    </div>
    {state.lastError&&<p role="alert" className="text-sm text-red-700">{state.lastError}</p>}
    <ul className="space-y-2">
      {visible.map(t=><li key={t.id} className="rounded-xl border p-3">
        {editingId===t.id?(
          <form className="flex flex-wrap gap-2" onSubmit={e=>submitEdit(e,t.id)}>
            <label className="sr-only" htmlFor={"rea074-edit-"+t.id}>Editar pendência</label>
            <input id={"rea074-edit-"+t.id} value={editingTitle} maxLength={MAX_LAB_TITLE}
              onChange={e=>setEditingTitle(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg border px-3 py-2 text-sm">Salvar</button>
            <button type="button" onClick={()=>{setEditingId(null);setEditingTitle("");}}
              className="rounded-lg border px-3 py-2 text-sm">Cancelar</button>
          </form>
        ):(
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
              <input type="checkbox" checked={t.completed}
                onChange={()=>{dispatch({type:"toggle",id:t.id});setCopyMessage("");}}
                className="h-4 w-4"/>
              <span className={t.completed?"text-muted-foreground line-through":""}>{t.title}</span>
            </label>
            <div className="flex items-center gap-2">
              {t.completed&&<CheckCircle2 className="h-4 w-4 text-emerald-700"/>}
              <button type="button" onClick={()=>{setEditingId(t.id);setEditingTitle(t.title);}}
                className="rounded-lg border px-3 py-1.5 text-xs">Editar</button>
            </div>
          </div>
        )}
      </li>)}
    </ul>
    {visible.length===0&&<p className="rounded-lg border p-4 text-sm text-muted-foreground">
      Nenhuma pendência nesta categoria.
    </p>}
    <div className="space-y-2 border-t pt-4">
      <button type="button" onClick={()=>void copy()}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900">
        <ClipboardCopy className="h-4 w-4"/> Copiar JSON demonstrativo
      </button>
      {copyMessage&&<p role="status" className="text-sm">{copyMessage}</p>}
      <p className="text-xs text-muted-foreground">
        Testes automatizados comprovam transições da lógica; uma interação real no navegador ainda precisa de homologação.
        Nenhuma tarefa é persistida, enviada ou excluída de sistemas reais.
      </p>
    </div>
  </section>;
}
