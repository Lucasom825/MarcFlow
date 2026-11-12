/**
 * NEXUS 074: independent behavioral prototype for synthetic meeting follow-ups.
 * Original implementation; no TodoMVC/Express source imported, copied or run.
 * No persistence, network I/O, account identity or real Memora integration.
 */
export type LabTask = Readonly<{id:string;title:string;completed:boolean}>;
export type LabState = Readonly<{
  tasks:readonly LabTask[];
  nextId:number;
  lastError:string|null;
}>;
export type LabAction =
  | {type:"create";title:string}
  | {type:"toggle";id:string}
  | {type:"rename";id:string;title:string};
export type LabFilter="all"|"open"|"done";

export const MAX_LAB_TASKS=12;
export const MAX_LAB_TITLE=120;

export const initialLabState:LabState={
  tasks:[
    {id:"demo-1",title:"Conferir responsáveis da ata demonstrativa",completed:false},
    {id:"demo-2",title:"Validar prazo de uma tarefa fictícia",completed:true},
  ],
  nextId:3,
  lastError:null,
};

export function normalizeLabTitle(value:string):string|null{
  if(typeof value!=="string")return null;
  const text=value.trim();
  if(!text || text.length>MAX_LAB_TITLE || /[\u0000-\u001f\u007f]/.test(text))return null;
  return text;
}

export function applyLabAction(state:LabState,action:LabAction):LabState{
  if(action.type==="create"){
    const title=normalizeLabTitle(action.title);
    if(!title)return {...state,lastError:"Informe uma descrição válida de até 120 caracteres."};
    if(state.tasks.length>=MAX_LAB_TASKS)
      return {...state,lastError:"Limite de 12 tarefas demonstrativas atingido."};
    return {
      tasks:[...state.tasks,{id:"demo-"+state.nextId,title,completed:false}],
      nextId:state.nextId+1,
      lastError:null,
    };
  }
  if(action.type==="toggle"){
    if(!state.tasks.some(t=>t.id===action.id))return state;
    return {
      ...state,lastError:null,
      tasks:state.tasks.map(t=>t.id===action.id?{...t,completed:!t.completed}:t),
    };
  }
  if(action.type==="rename"){
    if(!state.tasks.some(t=>t.id===action.id))return state;
    const title=normalizeLabTitle(action.title);
    if(!title)return {...state,lastError:"A edição precisa de uma descrição válida."};
    return {
      ...state,lastError:null,
      tasks:state.tasks.map(t=>t.id===action.id?{...t,title}:t),
    };
  }
  return state;
}

export function filteredLabTasks(state:LabState,filter:LabFilter):readonly LabTask[]{
  return state.tasks.filter(t=>filter==="all" || (filter==="done"?t.completed:!t.completed));
}

export function labCounts(state:LabState){
  const done=state.tasks.filter(t=>t.completed).length;
  return {total:state.tasks.length,done,open:state.tasks.length-done};
}

/** Explicitly user-initiated, local JSON snapshot. Not stored or uploaded. */
export function snapshotLabTasks(state:LabState):string{
  return JSON.stringify({
    schema:"NEXUS_074_SYNTHETIC_TASKS_V1",
    verified_behavior:"pure_reducer_unit_tests_only",
    production_integration:false,
    sample_only:true,
    tasks:state.tasks.map(({id,title,completed})=>({id,title,completed})),
  },null,2);
}
