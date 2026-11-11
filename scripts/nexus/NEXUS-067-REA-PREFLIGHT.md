# NEXUS 067 — Primeira ponte segura entre o demonstrador e a REA

Data: 11/11/2026. Estado: branch isolada em PR DRAFT, **não instalada no Codespace atual**, sem merge, deploy ou acesso a dados reais.

## O que foi implementado

- Nova tela `/dashboard/nexus/rea` no painel, visível apenas no modo `NEXT_PUBLIC_NEXUS_DEMO_ONLY=true`: o usuário informa `owner/repo` ou URL pública do GitHub.
- `GET /api/nexus/public-inspect?repo=...` exige sessão Auth.js autenticada e a flag `NEXUS_DEMO_ONLY=true`. O proxy libera apenas GET nesse caminho, nunca POST/PUT/DELETE.
- O backend só consulta endpoints oficiais públicos `https://api.github.com/repos/...`, com nomes de repositório validados, commit SHA de 40 dígitos, limite de resposta, limite de 3.000 entradas/75 MB de tamanho declarado e tempo máximo de 8,5 s por chamada.
- Retorna evidências estáticas: repo/commit fixado, licença **declarada** pelo GitHub, lista limitada de caminhos e arquivos JS/TS, scripts e dependências declarados no `package.json`. Não clona nem executa código de terceiro; scripts npm são apenas listados.
- A UI sugere diretórios JavaScript, identifica licença não reconhecida e mostra os parâmetros para o workflow **REA real** já presente no fork `Lucasom825/rea/.github/workflows/nexus-rea-toolkit.yml`: `target=public`, `repository`, `commit`, `directory`.
- O workflow da REA permanece **manual**. Nenhuma credencial GitHub é solicitada no formulário ou enviada ao navegador, nenhum token é repassado ao Docker. Não há execução de código-fonte no Codespace nem importação/reconstrução automática de aplicativos.
- Nenhuma alteração no editor, fluxos, banco de dados ou código REA existente. O botão Publicar continua bloqueado por política, mas ainda aparece no UI anterior; correção de visibilidade e fuso horário ficam para PR distinto.

## Regras de segurança

O endpoint recusa repositórios privados, arquivados, URLs com parâmetros, segmentos fora de owner/repo, árvores truncadas e entradas fora dos limites. Não há aprovação automática de licenças; a allowlist apenas replica os SPDX aceitos pelo workflow existente. Um repo sem licença verificada não recebe habilitação para copiar os parâmetros automaticamente. Dependências, scripts e descrições são **dados não confiáveis**, jamais instruções de execução. A etapa seguinte de adaptação exige análise de licença, segurança, contrato e testes funcionais.

## Testes

`scripts/nexus/test-public-preflight-067.ts` verifica: URL válida/host falso, commit imutável, contagem de arquivos/manifesto sem execução, rejeição de privado/arquivado/grande/truncado, licença desconhecida, manifesto corrompido, método único GET e bloqueio de ações perigosas, e proteção do adaptador GitHub contra traversal/URLs externas.

CI `.github/workflows/nexus-067-rea-preflight.yml`: 7 testes próprios, 37 da política demo, 18 de conversor e 17 do contrato. Verifica tipos somente dos arquivos da aplicação `src/`; os scripts de teste de fases anteriores têm erros de TypeScript preexistentes quando a checagem indiscriminada inclui todo o repositório. Esta distinção está documentada, sem atribuir sucesso de tipagem a esses scripts.

## Uso após revisão e teste no Codespace

A versão atual do usuário permanece na branch `nexus/codespaces-demo-066-20261111`. **A nova tela não aparece automaticamente**. Após validar CI e PR, trocar a branch do Codespace com cuidado para preservar o volume e `.env.nexus-demo` da demonstração, executar novamente `bash scripts/nexus/start-codespace-066.sh` (rebuild) e abrir `/dashboard/nexus/rea` no mesmo domínio privado. Começar por `axios/axios`. O clique no workflow REA levará ao GitHub Actions para execução deliberada; não afirmar que uma análise REA foi executada só porque a prévia foi gerada.

## Critérios ainda pendentes

1. Teste HTTP/browser end-to-end no Codespace atual com repo público real e autenticado.
2. Execução real e revisão de um relatório REA do workflow por escolha explícita do usuário.
3. Importação supervisionada de evidências da REA ao NEXUS, com rastreabilidade de job/commit, sem expor tokens.
4. Somente depois decidir se a reengenharia pode gerar/adaptar componentes isolados, nunca copiar indiscriminadamente código de terceiros.
