# NEXUS 069 — resultados reais da REA diretamente no demonstrador

**Data:** 11/11/2026. **Fase:** experimental; PR em rascunho sobre NEXUS 067. Não faz merge, não atualiza o Codespaces existente automaticamente, não toca em MySQL, fluxos, WhatsApp ou produção.

## Funcionalidade implementada

- A tela do NEXUS \`/dashboard/nexus/rea\` consulta automaticamente \`GET /api/nexus/rea/report\` e exibe o relatório verificado da REA (Axios, pasta \`lib\`) acima da tela de pré-análise.
- Há uma tela detalhada em \`/dashboard/nexus/rea/results\`, incluindo módulos mais referenciados, métricas AST/REA, inconclusões, Evidence ID, SHA-256 do relatório original, data em horário de Brasília e links da execução e do artefato no GitHub.
- A API é exclusivamente **GET**, exige sessão Auth.js, flag \`NEXUS_DEMO_ONLY=true\` e proteção no proxy. A consulta é feita no backend, sem credenciais do usuário no navegador, usando apenas recursos públicos fixos na API do GitHub.
- A fonte dos indicadores não é um valor estático inventado pela interface: o relatório resumido foi produzido automaticamente pelo workflow público experimental \`Lucasom825/rea\` na branch \`nexus/rea-axios-lib-068-20261111\`, salvo como \`nexus-pilot/public-reports/axios-lib-latest.json\`. O GitHub Actions executa a análise com \`contents:read\` e, em um *job separado* com \`contents:write\`, publica apenas campos públicos limitados.
- Antes de mostrar o resultado, o NEXUS verifica a identidade do alvo, formato do resumo, limites numéricos, bloqueio de execução de código-alvo, run ID e status \`completed/success\`, repositório, branch e workflow no GitHub Actions. Se faltar qualquer confirmação, exibe **resultado não confirmado**.

## Prova real

Workflow REA que publica automaticamente: https://github.com/Lucasom825/rea/actions/runs/43076663802 — SUCCESS em dois jobs: análise e publicação do resumo.

Fonte pública do relatório: https://github.com/Lucasom825/rea/blob/nexus/rea-axios-lib-068-20261111/nexus-pilot/public-reports/axios-lib-latest.json

Execução do Axios fixada em \`4ee8d46fc463770b8f5da718d5449a5b027b2c08\` e \`lib\`. Métricas derivadas do documento: 72/72 JS, 0 parse failures, 200/200 import sites AST reconciliados, 178 pares de dependências internas, 7 candidatos adicionais da REA ainda não validados, 13641 incógnitas semânticas, status **COBERTURA_ESTRUTURAL_COM_RESSALVAS**, comportamento-alvo **não executado**. Acesso original do artefato: https://github.com/Lucasom825/rea/actions/runs/43076663802/artifacts/13882073030 (retenção limitada pelo workflow GitHub; o JSON de resumo fica na branch experimental enquanto preservada).

## Fronteiras

1. Esta primeira integração automática cobre **somente o alvo fixo Axios/lib** do workflow experimental 068. Ainda não há fila geral, escolha automática do repositório, gatilho remoto entre NEXUS e REA para quaisquer projetos, importação de artefatos ZIP, nem construção de novos sistemas.
2. O backend confere metadados públicos do GitHub Actions e campos do resumo publicado pelo workflow. Não rebaixa automaticamente o ZIP original para recalcular seu hash em cada acesso; o hash exibido foi calculado durante a publicação pelo job.
3. O aplicativo atual da pessoa permanece em Codespaces na branch \`nexus/rea-public-preview-067-20261111\`. Para ver a novidade precisará atualizar seu próprio Codespace para NEXUS069 com **git fetch**, **git switch** e **bash scripts/nexus/start-codespace-066.sh**, preservando \`.env.nexus-demo\` e o volume MySQL. Não excluir nem recriar o Codespace. Verificar porta **39164 PRIVADA**. Não compartilhar capturas da aba de segredos.
4. Os arquivos de credenciais do demonstrador foram mostrados em uma captura anterior: recomenda-se rotação controlada no futuro, **com backup e sem sobrescrever credenciais que protegem o banco**. Essa operação não está dentro do escopo 069.
5. Resultados de análise estática não demonstram funcionalidade real, equivalência, segurança ou direito irrestrito de reutilizar código.
6. O uso do Codespaces e de GitHub Actions pode consumir cotas da conta. Não foi ativada infraestrutura contínua ou aplicativo de produção.

## Qualidade e testes

\`scripts/nexus/test-rea-report-069.ts\`: consulta mock verificada com dois endpoints fixos, rejeição de commits, licença/proveniência errada, falsificação de run, excedentes, variações de método e SSRF.

\`scripts/nexus/prove-live-rea-report-069.ts\`: HTTP REAL para API pública do GitHub em CI (sem token), valida o último JSON publicado e o status da execução original.

\`.github/workflows/nexus-069-report.yml\`: repete 069 + regressão NEXUS 067/064 e tipagem real do aplicativo (scripts históricos de testes têm erros de TypeScript documentados previamente e são excluídos do gate exclusivo da aplicação). Exige alteração restrita a arquivos do novo módulo, sem modificar editor, banco ou serviços.

**Próxima fase após teste humano:** generalizar o registro de resultados por execução/repositório mantendo índices, evidência e controle de licenças; depois estudar uma demonstração funcional supervisionada de componente licenciado, em sandbox isolado.
