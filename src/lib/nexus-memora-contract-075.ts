/**
 * NEXUS 075 - READ ONLY task reconciliation plan, not a Memora integration.
 * Locally simulated task records and strictly pure deterministic functions.
 * NEVER calls a connector, performs a write, or handles credentials.
 */
export type SourceTask = Readonly<{
  meeting_id:string;
  task:string;
  responsible?:string;
  deadline?:string;
  priority?:string;
  status?:string;
}>;
export type RemoteTask = SourceTask & Readonly<{task_id:string}>;
export type PlanStatus="SKIP_SAME"|"REVIEW_CONFLICT"|"PROPOSE_CREATE"|"REJECT_INVALID";
export type ProposedAction=Readonly<{
  status:PlanStatus;
  source:SourceTask;
  reason:string;
  matching_task_ids:readonly string[];
}>;
export type ReviewPlan=Readonly<{
  source_count:number;
  existing_count:number;
  actions:readonly ProposedAction[];
  creates:number;
  skipped:number;
  conflicts:number;
  rejected:number;
  writes_performed:0;
}>;

function legalText(v:unknown,max:number):v is string{
  return typeof v==="string" && !!v.trim() && v.length<=max &&
    !/[\u0000-\u001f\u007f]/.test(v);
}
function safeField(v:unknown,max:number):boolean {
  return v===undefined || (typeof v==="string" &&
    v.length<=max && !/[\u0000-\u001f\u007f]/.test(v));
}
export function validateSourceTask(t:SourceTask):boolean{
  return !!t && legalText(t.meeting_id,80) &&
    /^[a-zA-Z0-9_-]+$/.test(t.meeting_id) && legalText(t.task,240) &&
    safeField(t.responsible,120) && safeField(t.deadline,40) &&
    safeField(t.priority,40) && safeField(t.status,40);
}
function comparable(t:SourceTask):string {
  return [t.task,t.responsible??"",t.deadline??"",t.priority??"",t.status??""]
    .map(v=>v.trim().toLocaleLowerCase("pt-BR")).join("\u001f");
}
function normalizedKey(t:SourceTask):string{
  return t.meeting_id+"\u0000"+t.task.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
}
/** Conservative, meeting-scoped exact-title matching. No fuzzy merge, no updates. */
export function planMemoraTasks(
  proposals:readonly SourceTask[],
  existing:readonly RemoteTask[]
):ReviewPlan{
  if(proposals.length>50 || existing.length>100){
    throw new Error("Limite de simulação excedido: até 50 candidatas e 100 existentes.");
  }
  const lookup=new Map<string,RemoteTask[]>();
  for(const task of existing) {
    if(!validateSourceTask(task) || !legalText(task.task_id,100)) {
      throw new Error("Inventário de tarefas existentes é inválido.");
    }
    const k=normalizedKey(task);
    lookup.set(k,[...(lookup.get(k)??[]),task]);
  }
  const seen=new Map<string,number>();
  for(const t of proposals){
    if(validateSourceTask(t))seen.set(normalizedKey(t),(seen.get(normalizedKey(t))??0)+1);
  }
  const actions=proposals.map(source=>{
    if(!validateSourceTask(source))return {
      status:"REJECT_INVALID" as const,source,
      reason:"Identificador de reunião, texto ou campo adicional inválido.",
      matching_task_ids:[],
    };
    const key=normalizedKey(source);
    const matches=lookup.get(key)??[];
    if((seen.get(key)??0)>1 || matches.length>1)return {
      status:"REVIEW_CONFLICT" as const,source,
      reason:"Mais de uma ocorrência para a mesma tarefa na mesma reunião. Revisão humana obrigatória.",
      matching_task_ids:matches.map(t=>t.task_id),
    };
    if(matches.length===1){
      return comparable(matches[0])===comparable(source)?{
        status:"SKIP_SAME" as const,source,
        reason:"Tarefa já identificada na mesma reunião, sem divergência textual nos campos informados.",
        matching_task_ids:[matches[0].task_id],
      }:{
        status:"REVIEW_CONFLICT" as const,source,
        reason:"A tarefa existe, mas algum campo diverge. Nunca atualizar automaticamente.",
        matching_task_ids:[matches[0].task_id],
      };
    }
    return {
      status:"PROPOSE_CREATE" as const,source,
      reason:"Nenhuma tarefa de mesmo título nesta reunião; candidato pendente de autorização e validação.",
      matching_task_ids:[],
    };
  });
  return {
    source_count:proposals.length,existing_count:existing.length,actions,
    creates:actions.filter(x=>x.status==="PROPOSE_CREATE").length,
    skipped:actions.filter(x=>x.status==="SKIP_SAME").length,
    conflicts:actions.filter(x=>x.status==="REVIEW_CONFLICT").length,
    rejected:actions.filter(x=>x.status==="REJECT_INVALID").length,
    writes_performed:0,
  };
}

export const sampleExisting075:readonly RemoteTask[]=[
  {task_id:"synthetic-existing-1",meeting_id:"meeting_demo_001",
    task:"Revisar ata demonstrativa",responsible:"",deadline:"",status:"OPEN"},
  {task_id:"synthetic-existing-2",meeting_id:"meeting_demo_001",
    task:"Confirmar prazo fictício",status:"OPEN"},
];
export const sampleProposals075:readonly SourceTask[]=[
  {meeting_id:"meeting_demo_001",task:"Revisar ata demonstrativa",
    responsible:"",deadline:"",status:"OPEN"},
  {meeting_id:"meeting_demo_001",task:"Confirmar prazo fictício",status:"DONE"},
  {meeting_id:"meeting_demo_001",task:"Enviar resumo de teste",status:"OPEN"},
  {meeting_id:"meeting_demo_002",task:"Revisar ata demonstrativa",status:"OPEN"},
];
export function summarizePlan075(plan:ReviewPlan):string{
  const title="NEXUS 075 — Planejamento sem gravação (dados inteiramente fictícios)";
  const actions=plan.actions.map((entry,i)=>{
    const safeTitle=validateSourceTask(entry.source)?entry.source.task:"<entrada inválida>";
    return (i+1)+". "+entry.status+" | "+entry.source.meeting_id+
      " | "+safeTitle+" | "+entry.reason;
  });
  return [title,
    "Propostas: "+plan.source_count+" | Existentes: "+plan.existing_count,
    "Sugeridas: "+plan.creates+" | Já existentes: "+plan.skipped+
      " | Revisão humana: "+plan.conflicts+" | Rejeitadas: "+plan.rejected,
    "Operações de escrita executadas: ZERO",
    ...actions,
    "Integração real ao Memora NÃO configurada. Solicitar autorização específica, conta e revisão antes de gravar.",
  ].join("\n");
}
