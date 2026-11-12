/**
 * NEXUS 073 — evidence-backed reuse triage.
 * Pure, client-safe functions. This module never downloads, installs,
 * executes, scores compatibility or approves reuse of third-party code.
 */
export const REA_REUSE_PROJECTS=[
  {id:"NEXUS",label:"NEXUS",interest:"Integração de sistemas e ferramentas"},
  {id:"REA",label:"REA",interest:"Análise e rastreabilidade de código público"},
  {id:"Memora",label:"Memora",interest:"Registro e acompanhamento de reuniões"},
  {id:"Liame",label:"Liame",interest:"Operações e integrações de locação"},
  {id:"Eventus",label:"Eventus",interest:"Operações e integrações de eventos"},
] as const;
export type ReaReuseProject=(typeof REA_REUSE_PROJECTS)[number]["id"];

export type Rea073Report={
  run_id:number;
  status:string;
  target:{repository:string;commit:string;directory:string};
  structural_hubs:{module:string;direct_dependents:number}[];
  uncertainties:string[];
  checks:{
    ast_js_files:number;rea_parsed_js:number;
    ast_import_sites:number;matched_import_sites:number;
    ast_unique_internal_import_pairs:number;
    additional_rea_unreconciled:number;
    rea_semantic_unknowns:number;
  };
  evidence_id:string;
  report_sha256:string;
  source_executed:false;
  behavior_test_verified:false;
};

export function inferRoleFromName(module:string):string{
  const name=module.split("/").pop()?.toLowerCase()??"";
  if(/^(utils?|helpers?)\./.test(name))
    return "Nome sugere utilitários ou funções compartilhadas; responsabilidade ainda não comprovada.";
  if(/^requests?\./.test(name))
    return "Nome sugere tratamento de requisições; comportamento ainda não comprovado.";
  if(/^responses?\./.test(name))
    return "Nome sugere tratamento de respostas; comportamento ainda não comprovado.";
  if(/^(app|application)\./.test(name))
    return "Nome sugere configuração da aplicação; comportamento ainda não comprovado.";
  if(/^views?\./.test(name))
    return "Nome sugere apresentação ou visualização; comportamento ainda não comprovado.";
  if(/^(error|errors|exception)\./.test(name))
    return "Nome sugere tratamento de falhas; comportamento ainda não comprovado.";
  return "Função não determinada pelo inventário; é necessária leitura humana do código.";
}
export function pinnedSourceUrl(report:Rea073Report,module:string):string|null{
  const {repository,commit,directory}=report.target;
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository) ||
     !/^[a-f\d]{40}$/i.test(commit) ||
     !/^[\w./@-]{1,180}$/.test(directory) ||
     !/^[\w./@-]{1,180}$/.test(module) ||
     [directory,module].some(s=>s.startsWith("/") || s.split("/").some(p=>p===".."||p==="."||p==="")))
      return null;
  return "https://github.com/"+repository+"/blob/"+commit+"/"+[directory,module].join("/").split("/").map(encodeURIComponent).join("/");
}
export function buildReaReuseDossier(report:Rea073Report,project:ReaReuseProject,module:string){
  const destination=REA_REUSE_PROJECTS.find(p=>p.id===project);
  const selected=report.structural_hubs.find(h=>h.module===module);
  if(!destination || !selected) return null;
  const sourceUrl=pinnedSourceUrl(report,module);
  const observed=[
    "Módulo listado no resumo público REA: "+selected.module,
    "Dependentes diretos identificados: "+selected.direct_dependents,
    "JavaScript processado: "+report.checks.rea_parsed_js+"/"+report.checks.ast_js_files,
    "Importações conciliadas: "+report.checks.matched_import_sites+"/"+report.checks.ast_import_sites,
    "Execução do código-alvo: não realizada",
    "Teste comportamental: não realizado",
  ];
  const pending=[
    "Examinar a implementação e delimitar a funcionalidade real",
    "Conferir licença, notices e licenças das dependências no commit",
    "Identificar dependências, versão de runtime e superfícies de ataque",
    "Validar adequação aos requisitos do projeto de destino",
    "Criar teste funcional isolado com entradas, saídas e falhas esperadas",
    "Comparar custo, manutenção e benefício com implementação original",
    "Solicitar aprovação específica antes de integrar ou implantar",
  ];
  const limitations=[
    report.checks.additional_rea_unreconciled+" importações/ocorrências adicionais não reconciliadas",
    report.checks.rea_semantic_unknowns+" incógnitas semânticas relatadas",
    "Não há evidência de funcionamento, segurança, equivalência ou reaproveitamento pronto",
  ];
  return {
    project:destination.id,
    projectInterest:destination.interest,
    module:selected.module,
    sourceUrl,
    observed,
    hypothesis:inferRoleFromName(module),
    pending,
    limitations,
    decision:"EM_INVESTIGAÇÃO — NÃO APROVADO PARA REUTILIZAÇÃO" as const,
  };
}
export function formatReaReuseDossier(
  report:Rea073Report,project:ReaReuseProject,module:string,objective:string
):string{
  const dossier=buildReaReuseDossier(report,project,module);
  if(!dossier)return "";
  const text=objective.trim().slice(0,400);
  return [
    "NEXUS 073 | Dossiê preliminar de aproveitamento (NÃO APROVADO)",
    "Destino: "+project,
    "Objetivo informado: "+(text||"A definir"),
    "Fonte: "+report.target.repository+" @ "+report.target.commit+
      " / "+report.target.directory,
    "Execução verificada: #"+report.run_id,
    "Evidência: "+report.evidence_id,
    "SHA-256 do relatório: "+report.report_sha256,
    "Candidato: "+dossier.module,
    "Fonte fixada: "+(dossier.sourceUrl??"Não validada"),
    "Estado: "+dossier.decision,
    "FATOS:",...dossier.observed.map(x=>"- "+x),
    "HIPÓTESE PELO NOME (NÃO COMPROVADA): "+dossier.hypothesis,
    "LIMITAÇÕES:",...dossier.limitations.map(x=>"- "+x),
    "VERIFICAÇÕES PENDENTES:",...dossier.pending.map(x=>"- "+x),
    "Origem dos dados: relatório estático; nenhuma instalação, reconstrução ou aprovação.",
  ].join("\n");
}
