# NEXUS 073 — mapa de aproveitamento, fase de triagem

Data: 12/11/2026 (Brasília)
Status: **branch experimental; sem merge, deploy ou aprovação para reaproveitamento**.

## Evidências de entrada
- Axios: REA GitHub Actions #43270659086, 72/72 arquivos JS e 200/200 locais de importação estática identificados.
- Express: REA GitHub Actions #43274412800, 6/6 arquivos JS e 57/57 locais de importação estática identificados.
- Ambos os relatórios se classificam como cobertura estrutural com ressalvas. A inspeção foi estática; o comportamento não foi verificado.

## Problema
O painel 072 mostra relações entre arquivos e métricas. Essas métricas **não provam que um recurso é reaproveitável**.

## Funcionalidade implementada
- Página /dashboard/nexus/rea/reuse?rea_run=<id> usa **somente GET** da API /api/nexus/rea/jobs/<id>, com sessão autenticada e validação prévia no servidor.
- Escolha local de um dos destinos NEXUS, REA, Memora, Liame e Eventus e de um módulo listado entre os hubs verificados.
- Geração de dossiê preliminar com observações, hipótese inferida apenas pelo nome do arquivo, riscos, link ao código no commit fixado e checklist de revisão.
- Botão de copiar texto localmente. Nenhum dado de usuário ou projeto é persistido.
- Decisão fixa: **EM INVESTIGAÇÃO — NÃO APROVADO PARA REUTILIZAÇÃO**.
- Sem avaliação comportamental, jurídica automatizada, de dependências transitivas ou integração de código.

## Pendências de avaliação real
1. Definir a necessidade concreta do projeto receptor e ganho mensurável.
2. Revisar manualmente trecho funcional de código no commit fixado.
3. Conferir licença, notices, permissões de uso e dependências transitivas.
4. Validar runtime, interfaces, segurança, manutenção e custos.
5. Implementar demonstração isolada com testes de sucesso e falhas.
6. Aprovação específica antes de instalação, merge, deploy ou integração.

## Portas e limites
- Base: nexus/rea-results-072-20261112, commit 4b389def1972114265a42788ed1893be74e1f840.
- PR NEXUS 072 continua em draft. Branch 073 não deve ser combinada com main automaticamente.
- Preservar banco, credenciais, editor e WhatsApp; Codespaces 39164 PRIVATE.
- Meta de custo adicional zero, sujeita às franquias GitHub/Codespaces. Não iniciar plano pago.
- CI e homologação visual são gates diferentes.

## Aceitação do piloto
- CI verde com test-rea-reuse-073.ts, regressões, TypeScript e proteção de caminhos.
- No Codespaces abrir Express #43274412800 e acionar "Avaliar aproveitamento no NEXUS 073".
- Verificar links no commit, evidências e ressalvas. Copiar dossiê sem salvar dados.
- Não instalar Express. Próximo piloto técnico: UM recurso pequeno, com testes reais em sandbox.

## Fontes
- https://github.com/Lucasom825/rea/actions/runs/43274412800
- https://github.com/Lucasom825/rea/actions/runs/43270659086
- https://github.com/Lucasom825/MarcFlow/actions/runs/43272944951
