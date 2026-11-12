# NEXUS 075 — contrato de interoperabilidade de tarefas (somente simulação)

Data: 12/11/2026 (Brasília)
Status: BRANCH EXPERIMENTAL, sem merge, sem deploy no Codespaces, sem acesso ou alteração ao Memora real.

## Por que esta fase existe
A versão 074 comprovou em CI o comportamento de um laboratório de pendências fictícias. Capturas anteriores demonstraram criação, conclusão, contadores, cópia e reinicialização por F5; o usuário confirmou edição e filtros verbalmente com 'feito', sem nova captura. Não houve conexão real ao Memora.

O Memora possui ferramentas de listagem, criação e atualização de tarefas através do conector ChatGPT, mas a conexão desse conector **não é automaticamente uma credencial de acesso do aplicativo Next.js no Codespaces**. Há duas contas/vínculos chamados 'Memora ia'; é necessário identificar explicitamente qual se destina ao projeto antes de consultar dados reais. Nenhuma foi usada aqui.

## Implementação 075
- Biblioteca pura src/lib/nexus-memora-contract-075.ts e interface /dashboard/nexus/rea/memora-contract.
- Dados sintéticos no código: 4 propostas de tarefas e 2 tarefas existentes, vinculadas a reuniões fictícias.
- Reconciliação determinística sem fuzzy matching, escopo obrigatório por meeting_id e título normalizado.
- Ações calculadas: SKIP_SAME (já existe sem divergências), REVIEW_CONFLICT (campos divergentes ou duplicidade ambígua), PROPOSE_CREATE (candidata nova em reunião distinta), REJECT_INVALID (entrada inválida).
- Travas: zero operações de escrita, IDs não gerados para itens externos, sem API, importação automática, contas, segredo, persistência, banco ou dados privados.
- Proposta de criação não é autorização. Nenhuma atualização automática é suportada, mesmo quando uma tarefa existente difere.
- Exportação manual opcional de resumo fictício por clipboard.

## Aceitação
1. CI verde: casos de mesma reunião e tarefa, reunião diferente, conflito de status/responsável/prazo, duplicação, dados inválidos, zero network/DB/localStorage, regressões 069–074, TypeScript e arquivos protegidos.
2. Instalar apenas na branch experimental do Codespaces (porta 39164 PRIVATE), testando a tabela de 4 propostas e o botão Copiar.
3. Revisar o contrato real do conector Memora em modo somente leitura com uma conta escolhida pelo usuário. Sem duplicar/alterar tarefas.
4. Só avaliar eventual escrita com autorização específica e gate de confirmação, deduplicação, logs de auditoria e rollback.

## Limites
A versão 075 **não estabelece integração direta** entre Codespaces e Memora; ela apenas testa a lógica de comparação de registros fictícios. Os campos reais, paginadores, permissões, estados e eventos do Memora precisam de validação separada. Não assumir custo zero ilimitado, apenas meta sem contratação adicional dentro das franquias.

## Evidência
- Versão 074 CI: https://github.com/Lucasom825/MarcFlow/actions/runs/43281747987
- Versão 074 PR draft: https://github.com/Lucasom825/MarcFlow/pull/18
