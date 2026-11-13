# NEXUS 085 — revalidação de usuário contra banco em cada consulta ao Memora 2

**Data:** 13/11/2026, Brasil. **Estado:** exclusivamente branch experimental, sem merge, deploy, segredos, consulta de conta real ou reuniões privadas.

## Problema encontrado no código fonte

A autenticação do MarcFlow/NEXUS usa NextAuth com sessão **JWT**:
- `src/auth.config.ts` atribui ID e papel do usuário ao token no login e os copia para `session.user`;
- `src/lib/auth.ts` busca usuário no Prisma e valida senha apenas durante o login;
- `prisma/schema.prisma` declara `User { id, name, email, password, role, apiKey, createdAt, updatedAt }`, sem `isActive`, `disabled` ou `deletedAt`.

Consequência: somente aceitar o JWT em leituras futuras não detecta usuário **excluído**, papel reduzido ou e-mail alterado depois da emissão do token. O controle de grant da versão 083 é uma configuração administrativa separada e também não substitui essa revalidação do usuário.

## Correção 085 implementada

`src/lib/nexus-memora2-db-reauth-085.ts` introduz `revalidateNexusUser085`, um verificador de **consulta somente leitura** por ID da sessão, exclusivamente com os campos Prisma `id`, `email` e `role` (`select`). **Não consulta password, apiKey, sessões de WhatsApp, mensagens, áudios ou dados de reunião.**

A API GET `/api/nexus/memora2/readiness` executa em ordem:
1. recusa demo, bridge sem configuração ou sessão sem e-mail autorizado;
2. valida grant e identidade 083 (ID, e-mail, role, UUID Memora aprovado, expiração e revogação);
3. **consulta o usuário atual no MySQL por ID** e exige a mesma identidade/e-mail/papel autorizados;
4. recusa usuário inexistente, papel incompatível ou e-mail alterado com 403; se a base está indisponível, retorna 503 (**fail-closed**);
5. valida grant 083 novamente e somente então envia GET HMAC v2 084 ao Memora 2.

A página privada do NEXUS aplica a mesma revalidação antes de exibir o painel; o GET verifica tudo novamente a cada clique (não confia na autorização da página).

## Testes sintéticos

`scripts/nexus/test-memora2-db-reauth-085.ts` usa um repositório de usuários **simulado em memória**, não usa conexão de banco real:
- conta atual autorizada;
- conta excluída com JWT ainda vigente;
- mudança de papel OWNER→STAFF;
- mudança de OWNER→SUPERADMIN (exige nova sessão por papel divergente);
- alteração do e-mail ou ID;
- sessão sem campos necessários e sem consulta ao banco;
- erro de banco com resposta genérica sem diagnóstico sensível;
- confirmação de que a revalidação acontece antes da chamada externa;
- teste que comprova ausência de um campo de ativação na versão do schema lida.

Workflow `.github/workflows/nexus-085-db-reauth-gate.yml` também executa regressões HMAC 084, identidade 083, cliente 078, readiness 076, contrato 075 e TypeScript com Prisma generate (sem conectar banco). Bloqueia alterações fora dos arquivos isolados, particularmente `prisma/schema.prisma` e migrations.

## **Limite fundamental — revogação parcial, NÃO desativação universal**

O modelo de `User` **não possui campo de conta ativa**. Portanto:
- exclusão física de usuário, troca de e-mail e perda/alteração de papel tornam o acesso ao Memora indisponível **na próxima consulta**;
- **desativação lógica** de conta sem exclusão, e sem alteração de papel/grant, **não pode ser detectada por esta versão**;
- a autorização/revogação de um grant 083 continua em variáveis de ambiente, não em uma tabela transacional, e não oferece propagação instantânea garantida;
- sessões JWT de outras áreas do MarcFlow/NEXUS **não foram alteradas**; este gate protege apenas a funcionalidade Memora 2;
- uma requisição que já passou pela verificação pode estar em andamento quando uma conta for alterada; não declarar bloqueio atômico de chamadas em curso.

**Próxima etapa proposta (086):** desenhar um controle de desativação e concessão em **base de dados auditável** (ex.: status do usuário, revogação transacional, histórico de grants, relação com owner Memora e revisão de migração), primeiro em ambiente de testes. NÃO inserir migrations ou aplicar `prisma db push` em produção sem autorização específica. Verificar contas reais e custos só com permissão distinta.

## Regras de segurança e custos

- Não fornecer IDs reais, e-mails privados, senhas, segredos ou dados de reuniões ao GitHub ou à interface NEXUS.
- Conta demo continua bloqueada; um banco sem conexão retorna 503, sem mecanismo substituto de permissão.
- Nenhum serviço pago adicional foi criado. O ambiente efetivo, cotas Cloudflare e custo de eventual ativação permanecem não auditados.
- Manter PR DRAFT, sem merge ou deploy. Não alterar a versão canônica v18.0 da Memória Viva por esta prova.
- Exigir aprovação específica antes de implementar esquema, conceder acesso, instalar segredos, implantar ou ler reuniões reais.

## Evidência anterior

- NEXUS 084, PR #27: https://github.com/Lucasom825/MarcFlow/pull/27
- Memora 2 084, PR #194: https://github.com/Lucasom825/memora-2-cloudflare/pull/194
- NEXUS 084 CI: https://github.com/Lucasom825/MarcFlow/actions/runs/43426511354
- Memora 2 084 CI: https://github.com/Lucasom825/memora-2-cloudflare/actions/runs/43426606702
