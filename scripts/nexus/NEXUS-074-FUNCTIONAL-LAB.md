# NEXUS 074 — primeiro protótipo comportamental isolado

Data: 12/11/2026 (Brasília)
Estado: branch experimental; sem merge, deploy, serviços pagos ou integração Memora.

## Decisão de escopo
O 073 comprovou a triagem estrutural do módulo Express utils.js, mas inspeção real identificou ETag, MIME, parser HTTP e proxy; **não vale copiar o módulo inteiro** para o NEXUS. Para começar a provar comportamento de uma função relevante aos projetos do usuário, foi escolhido um laboratório original de acompanhamento de pendências de reunião, que é uma necessidade operacional concreta do Memora e de outros projetos.

TodoMVC foi consultado como referência de categorias de comportamento (criação, consulta, atualização, conclusão), mas a licença exibida pelo GitHub para tastejs/todomvc é NOASSERTION no commit consultado, e este NEXUS 074 **NÃO copia nenhum trecho do repositório externo**. Todo o redutor de estado, validação, filtros e interface foram escritos especificamente para este laboratório. Nenhuma afirmação de engenharia reversa funcional de terceiros ou equivalência está sendo feita.

## Capacidade criada
- Criar, editar, concluir/reabrir e filtrar pendências **fictícias**, 12 no máximo, título de até 120 caracteres.
- Contagens testáveis (total, pendentes, concluídas), IDs incrementais, revisão de entradas inválidas, estados imutáveis.
- Botão opcional para copiar um JSON **local** que indica explicitamente ser demonstração, não dados Memora.
- Sem armazenamento em servidor, banco, localStorage, cookies próprios, agendador, WhatsApp ou API; recarregar reinicia exemplos fictícios.
- Não expõe endpoints novos nem instala/executa código não revisado.
- Não permite excluir dados; não lê nem escreve as tarefas reais do Memora.

## Testes de comportamento
Arquivo scripts/nexus/test-functional-lab-074.ts testa:
1. Criar tarefa válida, aparar espaços, atribuir ID, preservar estado anterior.
2. Recusar vazios, controles, textos longos e excesso do limite.
3. Alternar conclusão e reabertura.
4. Filtrar e contar por status.
5. Editar um item sem alterar outro.
6. Rejeitar ID inexistente.
7. Exportar apenas JSON demonstrativo, sem token nem identidade.
8. Verificar ausência de chamadas de rede e armazenamento nos arquivos do laboratório.

CI combina esses testes com as regressões 069–073, política demo, editor existente, TypeScript e gate de arquivos. CI verde demonstra lógica e tipagem; **a UI só estará homologada após navegação no Codespaces privado pelo usuário**.

## Rotas e aceitação
- /dashboard/nexus/rea/reuse?rea_run=43274412800 (NEXUS 073)
- /dashboard/nexus/rea/lab (NEXUS 074)
- Teste no navegador: criar uma pendência fictícia, marcar concluída, filtrar concluidas, editar descrição, copiar JSON e recarregar para confirmar reset.
- Sem aprovação para integrar ao Memora; persistência real, auth multiusuário, tarefas e reuniões reais, auditoria e integração MCP exigem projeto separado e autorização específica.

## Fonte e riscos
- REA Express analisou estrutura, não comportamento: https://github.com/Lucasom825/rea/actions/runs/43274412800
- Código Express inspeção: https://github.com/expressjs/express/blob/43fca52d28a422c8be48fd489cbd4f2d6152bab6/lib/utils.js
- Base TodoMVC consultada como referência conceitual, licença GitHub NOASSERTION: https://github.com/tastejs/todomvc
- Sem reuso de código externo, logo a prova funcional valida o componente NEXUS original, e não afirma reconstrução do Express ou do TodoMVC.
