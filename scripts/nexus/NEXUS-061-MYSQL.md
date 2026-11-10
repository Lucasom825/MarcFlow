# NEXUS 061 — persistência autenticada do rascunho com MySQL descartável

**Estado:** experimento em branch, sem merge, deploy ou conexão com banco de produção.

## Motivação e correção factual

O MarcFlow usa `provider = "mysql"` em `prisma/schema.prisma`, não PostgreSQL. Esta fase faz `prisma db push` em um **MySQL 8 efêmero do GitHub Actions**, isolado e descartado ao terminar a execução.

## O que é testado de verdade

O teste `scripts/nexus/mysql-draft-route-test.ts` importa **diretamente os handlers reais**:
- `GET src/app/api/flows/[sessionId]/[flowId]/route.ts`;
- `PUT src/app/api/flows/[sessionId]/[flowId]/draft/route.ts`.

A autenticação real por API key e as verificações de posse da sessão (`resolveFlow`) são executadas com usuários, sessões e fluxos **fictícios**, criados no banco de teste. As operações passam pelo Prisma e persistem de verdade nesse banco, incluindo retorno de revisão e leitura posterior.

### Cenários de prova

- Criação de registros sintéticos, leitura inicial, salvamento, leitura do estado persistido e revisão incremental;
- Segundo navegador/aba com revisão obsoleta recebe HTTP 409 sem sobrescrever;
- Duas gravações simultâneas com a mesma revisão: exatamente uma aceita, a outra rejeitada; estado consistente;
- Usuário de outra sessão não pode ler nem alterar esse fluxo; fluxo inexistente retorna 404;
- JSON incompleto ou malformado, nó inicial ausente, payload excessivo, revisão inválida e estrutura com elementos nulos são recusados sem gravações;
- Recuperação de snapshot válido anterior via **nova escrita com revisão atual**, sem alterar `publishedGraph` ou ativar o fluxo. Não equivale a rollback transacional nem desfaz operação de outro usuário.

**Defeito encontrado antes da correção:** `Number(body.revision)` convertia silenciosamente tipos inadequados e passava `NaN` ao Prisma, gerando exceção não tratada para valor inválido. A primeira execução da prova falhou nesse cenário após 18 verificações aprovadas: https://github.com/Lucasom825/MarcFlow/actions/runs/42884719909.

**Correção proposta para revisão, ainda NÃO integrada:** validação estrita da revisão (inteiro não negativo no domínio MySQL), tamanho real em bytes UTF-8 e proteção contra documento nulo, matriz como raiz e elementos nulos no grafo. Único arquivo de aplicação alterado: `src/app/api/flows/[sessionId]/[flowId]/draft/route.ts`.

## Segurança e limitações

- O job usa somente `mysql://...@127.0.0.1:3306/nexus061`, usuário e senha **fixos e descartáveis**, sem segredos reais; o banco e os registros são destruídos com o runner.
- O teste invoca os **handlers reais com NextRequest**, não todo o servidor HTTP Next.js via navegador. Portanto não prova middleware/proxy, cookies, autenticação interativa ou UX autenticada.
- Não foi testado um banco de staging persistente, migração produtiva, fluxos reais existentes, backups de produção, publicação nem WhatsApp.
- O endpoint de rascunho aceita conteúdo parcial por intenção do editor; a validação estrutural completa para **publicação** continua responsabilidade separada de `validateGraph`. Essas provas não equivalem a equivalência semântica universal Drawflow → MarcFlow.
- Não mudar o banco ativo, não enviar mensagens, não fazer merge/deploy sem autorização específica.

## Reprodução

No branch `nexus/mysql-draft-contract-061-20261110`, GitHub Actions executa automaticamente `.github/workflows/nexus-061-mysql.yml` com `services.mysql` e `NEXUS061_EPHEMERAL_ONLY=true`. O próprio teste recusa rodar se a URL não apontar a `127.0.0.1/nexus061`.

Próximo gate: revisão do patch, homologação em staging autenticado e persistência real por UI/browser, testes de integração de trás para frente, plano de rollback operacional e autorização de mudança produtiva.
