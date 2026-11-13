# NEXUS 086 — controle persistente de acesso e revogação, prova isolada

Data de implementação: 13/11/2026 (BRT).
Estado: somente código experimental em branch GitHub. Nenhuma alteração no MySQL, Prisma, NextAuth, sessão JWT, Cloudflare, Memora 2 ou produção; nenhum dado real consultado.

## Por que surgiu a etapa 086

Na versão 085 o NEXUS passou a revalidar ID, e-mail e papel diretamente no Prisma a cada solicitação de metadados do Memora 2. Isso detecta contas excluídas ou alteradas, mas o modelo User do projeto não contém status ativo/inativo, e a concessão 083 é apenas configuração administrativa em variáveis de ambiente. O modo de autorização não é persistente, transacional ou auditável no banco do aplicativo.

## Entrega efetivamente implementada — somente SQLite sintético

Arquivos:
- scripts/nexus/experiments/access-086-sqlite.mjs
- scripts/nexus/test-memora2-persistent-access-086.mjs
- .github/workflows/nexus-086-persistent-acl-gate.yml

O protótipo usa Node v22.16.0 DatabaseSync SQLite em um diretório temporário com nome nexus086-synthetic-*; recusa abrir qualquer arquivo de outro lugar ou sem aprovação explícita de simulação. Não importa o Prisma nem é chamado pelas rotas reais.

Três tabelas LOCAIS de demonstração:
1. nx086_subject — identificador fictício e status ACTIVE/SUSPENDED, criado inicialmente SUSPENDED (nega por padrão).
2. nx086_grant — concessão por sujeito + UUID do proprietário fictício + grant ID, validade até 30 dias, revogação persistida; índice único restringe concessões não revogadas sobrepostas para o mesmo proprietário/sujeito.
3. nx086_audit — identificador sequencial, timestamp, ator fictício, sujeito, grant ID e tipo de ação; sem e-mail, senha, áudio ou conteúdo de reunião.

Toda mudança administrativa no protótipo é realizada dentro de transação SQLite BEGIN IMMEDIATE/COMMIT, com rollback se a operação falha. Uma suspensão também revoga concessões anteriores; reativação NÃO ressuscita uma concessão cancelada. A leitura de permissão usa uma consulta SQL de estado atual, sem cache e sem escrever auditoria a cada solicitação. Fechar/reabrir o banco preserva revogações.

As operações de cadastro/ativação/suspensão/grant/revogação são funções de **fixture experimental**: não há UI, credencial ou API administrativa real. O parâmetro ator é fornecido pelo teste, NÃO é autenticação de operador nem prova de autorização humana.

## Evidências que a CI deve comprovar

- default deny para conta desconhecida/nova, campo inválido e banco indisponível;
- ativação exige ato explícito; concessão a suspenso negada;
- permissão somente para subject/owner/grant exatos e dentro do prazo;
- expiração na fronteira, no máximo 30 dias de validade;
- revogação persistida após fechar e reabrir SQLite;
- suspensão revoga concessões em transação, reativação exige novo grant;
- múltiplas conexões locais enxergam revogação;
- restrição de concessões sobrepostas e rollback sem auditoria falsa;
- log de operações auditáveis sem dados de reunião;
- nenhum arquivo Prisma, rota, autenticação global, segredo ou migração foi modificado.

A CI utiliza arquivos temporários, sem DATABASE_URL, não tem migração e não roda db push/migrate. Regressões 085/084/083/078 continuam verificando as proteções existentes no código, mas nenhuma fonte de dados de usuário real é acessada.

## Proposta para implementação FUTURA em MySQL/Prisma — NÃO EXECUTADA

Para reduzir o risco de afetar MarcFlow/NEXUS existente, a proposta preferida é **expandir** o schema em tabelas separadas vinculadas a User.id, não redefinir os mecanismos de login de todos os usuários numa única implantação.

Tabelas candidatas:

| Entidade proposta | Campos essenciais | Regra de segurança |
|---|---|---|
| NexusMemoraAccountStatus | userId (FK única User.id), status ACTIVE/SUSPENDED, updatedAt, updatedBy | Ausência de registro = acesso MEMORA 2 NEGADO; bootstrap somente após comprovação e aprovação |
| NexusMemoraGrant | id, userId FK, memoraOwnerUuid, issuedAt, expiresAt, revokedAt, createdBy | Exigir identidade 085, status ativo, grant exato do HMAC 084, validade máxima 30 dias e não revogado |
| NexusMemoraAudit | id, actorUserId, subjectUserId, grantId, action, timestamp, requestId opcional | Eventos administrativos sem segredos ou conteúdo de reuniões; acesso restrito e retenção definida |

Chaves/índices propostos: grantId único; userId+memoraOwnerUuid; status por userId; auditoria por subjectId+timestamp e grantId+timestamp. Avaliar unicidade de grants não revogados na implementação MySQL: NÃO presumir que índice parcial SQLite funcione no MySQL. Invariantes de concessão/renovação devem ser protegidas por transação e chave única adequada ao MySQL, não apenas por código de aplicação.

Plano de migração, sempre mediante autorização explícita e em staging antes da produção:

1. Preparar snapshot de schema do MySQL e histórico real de migrações. Validar versão Prisma usada no projeto (5.22.x), sem seguir comandos de documentação de versões diferentes às cegas.
2. Gerar migração expand-only revisável e criar tabelas auxiliares em banco STAGING efêmero; sem mudar automaticamente papel, sessão ou login da aplicação existente.
3. Começar com TODOS os acessos Memora 2 negados por padrão; nenhum backfill automático para ACTIVE.
4. Associar manualmente, com evidência, a conta NEXUS ao UUID proprietário Memora 2, registrar consentimento/grant e ator aprovado.
5. Incorporar gate persistente à rota API de leitura, após grants 083, revalidação 085 e antes de qualquer chamada HMAC 084; manter checagens 080/082 de replay/rate limit do outro lado.
6. Implementar ações administrativas autenticadas com controle de privilégio, CAS/versionamento ou transação robusta, idempotência, auditoria, revogação e rotação. Um ator de teste não serve para produção.
7. Testar dois processos/instâncias, concorrência, transações, desligamento instantâneo na próxima consulta, suspensão durante chamadas e não reativação de grants antigos.
8. Documentar backup, rollback de feature flag (desligar a ponte), custos, retenção, alertas e revisão independente antes de deploy. Não reabrir o protocolo HMAC v1 em rollback.

## Bloqueadores e riscos que ainda existem

- SQLite NÃO é o MySQL da aplicação. O comportamento transacional, índices e migrações em MySQL/Prisma **não estão homologados**. Não substituir infraestrutura produtiva por este protótipo.
- A auditoria local é transacional e rastreável, mas NÃO é resistente a adulteração por um administrador com acesso irrestrito ao banco. Avaliar privilégios e logs externos antes de afirmar auditoria inviolável.
- O protótipo não autentica operadores, nem prova que a pessoa natural dona das contas é a mesma; essas verificações continuam obrigatórias.
- Não há revalidação de situação de conta para todas as rotas do NEXUS, somente na rota isolada 085. O novo status 086 ainda NÃO foi conectado a nenhuma rota.
- Concessão 083 de ambiente e a concessão proposta persistente não foram sincronizadas. Garantir alinhamento com o HMAC assinado 084 e regras de revogação antes de qualquer uso real.
- Não houve consulta ao banco real, verificação de consumo Cloudflare, verificação de permissão para migração, definição de operador, tráfego real ou alteração produtiva.
- Não solicitar compra/contratação ou criar serviço pago sem autorização. O custo futuro da hospedagem/DB é INCONCLUSIVO.

## Stop rule: impedir uma sequência interminável de demonstrações

Após verificar o NEXUS 086, não criar automaticamente outro conjunto de fases por inércia. O próximo avanço deve ser **consolidar as PRs 075–086**, auditar o deployment e preparar um staging isolado com critérios objetivos de aceite: identidade comprovada, autorização individual, auditoria, latência, custo, segurança e leitura minimizada. A passagem do conceito para a operação real exige aprovação específica para schema/credenciais/deploy e dados do Memora 2.

## Fontes oficiais efetivamente verificadas

- Node v22.16.0 SQLite DatabaseSync: https://nodejs.org/download/release/v22.16.0/docs/api/sqlite.html
- Prisma Migrate v6 (referência de conceitos, NÃO substituir a referência v5 efetiva do repo): https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production
- Prisma migrate deploy: https://docs.prisma.io/docs/cli/migrate/deploy

Histórico: NEXUS 085, PR #28 — https://github.com/Lucasom825/MarcFlow/pull/28 ; CI #43438780824 concluída SUCCESS.
