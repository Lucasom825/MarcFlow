# NEXUS 083 — autorização de identidade e prontidão para integração Memora 2

**13/11/2026 — somente branches experimentais, sem merge, deploy, credenciais ou dados reais.**

## Decisão
O login fictício do NEXUS permanece impedido de receber metadados do Memora 2. A implementação anterior permitia apenas uma comparação de e-mail com uma configuração de ambiente; isso não é comprovação de proprietário.

O NEXUS 083 passou a exigir, **além** da configuração da ponte 078:
- ID exato do usuário autenticado no NEXUS, extraído da sessão NextAuth (`session.user.id`), sem confiar apenas no e-mail;
- papel `OWNER` ou `SUPERADMIN` autorizado;
- e-mail de sessão coerente com o e-mail revisado e com a configuração da ponte;
- UUID Memora 2 de um único proprietário explicitamente configurado;
- identificação de um termo/registro de autorização `grant_...`;
- expiração UTC (até 30 dias) e controle de revogação (`IDENTITY_REVOKED=false`);
- `IDENTITY_APPROVED=true`, desligado na ausência de qualquer campo.

Implementação: `src/lib/nexus-memora2-identity-083.ts`. A API `GET /api/nexus/memora2/readiness` e a página restrita no NEXUS agora negam acesso quando esse vínculo local está ausente, revogado, vencido ou incompatível.

## Contrato de configuração — NEXUS (NÃO CONFIGURAR AGORA)
- `NEXUS_MEMORA2_IDENTITY_APPROVED`: habilitação explícita após dupla checagem operacional
- `NEXUS_MEMORA2_IDENTITY_REVOKED`: `false` somente com autorização válida
- `NEXUS_MEMORA2_APPROVED_NEXUS_USER_ID`: ID interno do usuário NEXUS a conferir no banco, não e-mail
- `NEXUS_MEMORA2_APPROVED_NEXUS_EMAIL`: e-mail correspondente ao mesmo usuário
- `NEXUS_MEMORA2_APPROVED_MEMORA_OWNER_ID`: UUID da conta correta do Memora 2, a conferir na implantação
- `NEXUS_MEMORA2_ACCESS_GRANT_ID`: `grant_...` sem dados pessoais
- `NEXUS_MEMORA2_GRANT_EXPIRES_UTC`: ISO UTC com precisão de segundos, validade máxima de 30 dias

Essas variáveis **não são credenciais**, mas IDs/e-mails privados de conta não devem ser publicados em README, CI, URL ou log. A chave HMAC permanece um segredo exclusivo de ambiente de servidor.

## Limite fundamental da homologação sintética

A correspondência entre ID de conta NEXUS e UUID Memora 2 foi simulada, **não atestada para um usuário real**. O ID da sessão NEXUS vem de JWT e não é revalidado no banco em cada requisição; isso precisa ser reavaliado para cancelamento imediato de acesso/remoção de usuário.

**O grant ID e o UUID configurados dos dois lados ainda não são assinados juntos no protocolo HMAC 078.** Um operador pode configurar identidades diferentes nos dois ambientes sem que o protocolo as confronte automaticamente. Portanto a ativação continua BLOQUEADA até vincular criptograficamente o grant ao proprietário e auditar a correspondência no backend, além dos testes já feitos. Não afirmar proteção multiusuário.

## Política de revogação — antes de ativar
- Ausência de grant => deny.
- Grant revogado em qualquer lado => deny nesse lado.
- Grant expirado => deny até nova autorização.
- Desabilitar feature flag / retirar segredo deverá interromper acesso; exigir evidência de propagação entre ambientes e tempos de cache.
- Revogação imediata de JWT e alteração de e-mail/role precisa de cheque de usuário de origem/DB (pendente).
- Não manter tokens, UUIDs e conteúdo de reuniões em logs operacionais.

## Custos — fontes públicas verificadas em 13/11/2026

- Cloudflare Durable Objects SQLite disponível no Workers Free, sujeito a quotas; segundo preço público, 100.000 requisições/dia são incluídas, e ao exceder limites de Free operações podem falhar (não é prova de quota disponível na conta): https://developers.cloudflare.com/durable-objects/platform/pricing/
- A documentação de limites atual descreve 5GB SQLite por conta Free e outros limites: https://developers.cloudflare.com/durable-objects/platform/limits/
- Segredos devem ser mantidos em Workers secrets, jamais em arquivo `.env` versionado ou `vars` públicas: https://developers.cloudflare.com/workers/configuration/secrets/
- Não foi possível inspecionar faturamento, uso real, limites restantes, configuração de plano ou infraestrutura já consumida na conta; **custo adicional = INCONCLUSIVO**, não contratar recursos pagos sem autorização.

## Gate de publicação e rollback (NÃO EXECUTAR)

1. Revisar o código dos dois PRs 083 e todos os PRs 078–082, sem merge implícito ou promover branches empilhadas de forma cega.
2. Confirmar a identidade NEXUS no banco real, o UUID titular Memora 2 e registro inequívoco de consentimento sem expor identificadores.
3. Evoluir a assinatura para incluir em um payload versionado o **owner UUID e grant ID**, verificável pelas duas pontas; bloquear protocolo 078 legado em produção.
4. Revisar revalidação de JWT, revogação imediata, quota, logs mínimos, alertas, tratamento de erros e permissões de binding.
5. Estabelecer ambiente staging isolado, workflow de implantação revisado, teste E2E com contas e reuniões autorizadas, timeout e medidas de custo.
6. Requerer autorização **separada** para criar credencial, atualizar Cloudflare, habilitar serviço/segredo e permitir consultas de dados reais.
7. Planejar rollback: negar feature flag em ambos os lados, revogar chave, retirar binding ou parar Worker, confirmar HTTP 404/403/503 e ausência de leitura, preservar evidências de logs sem dados sensíveis. Não apagar dados ou recursos sem outra autorização.
8. Depois de homologar, atualizar o documento de versão ativa; a Memória Viva canônica v18.0 **permanece** inalterada por essa prova.

## Fontes de código
- MarcFlow/NEXUS: branch `nexus/memora2-identity-083-20261113`
- Memora 2 (privado): branch `nexus/readiness-identity-083-20261113`
- Última etapa 082 aprovada: https://github.com/Lucasom825/memora-2-cloudflare/actions/runs/43303458430
