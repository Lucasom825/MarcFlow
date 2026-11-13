# NEXUS 084 — contrato criptográfico vinculado ao proprietário e autorização

**Data:** 13/11/2026 (Brasília). **Estado:** experimental, feature flags desligadas, sem deploy/merge/segredos/contas reais.

## Problema remediado no protocolo

Até a versão 083 o HMAC incluía versão v1, método GET, caminho, timestamp, nonce e client-id, mas **não o UUID do proprietário nem a referência da autorização**. Os dois lados podiam estar configurados com identidades divergentes sem que a assinatura, isoladamente, detectasse a divergência.

NEXUS 084 cria o cliente de leitura server-to-server `src/lib/nexus-memora2-bridge-084.ts`, usado pela **rota operacional experimental** `src/app/api/nexus/memora2/readiness/route.ts`.

Novo payload HMAC-SHA256 v2, campos em linhas e nesta ordem:
1. `memora-nexus-readiness-v2`;
2. `GET`;
3. `/api/integrations/nexus/readiness`;
4. timestamp Unix em segundos;
5. nonce hexadecimal de 16 bytes aleatórios;
6. client-id fixo `nexus-memora2-v1`;
7. UUID do proprietário Memora 2, minúsculo, aprovado no gate 083;
8. ID da concessão `grant_...`, aprovado no gate 083.

Cabeçalhos adicionais: `x-memora-nexus-protocol: 2`, `x-memora-nexus-owner` e `x-memora-nexus-grant`. O verificador do Memora 2 exige coincidência exata com a autorização local aprovada, expiração válida e assinatura HMAC íntegra. O cliente manda GET fixo sobre HTTPS com host de configuração permitido, sem cookies e sem redirecionamentos, timeout 5 s, resposta JSON até 16 KiB e apenas dados técnicos mínimos.

**Não há downgrade para v1 na rota operacional NEXUS nem na rota correspondente do Memora 2.** Módulos legados 078 continuam presentes apenas para histórico/regressões; não devem ser usados para ativar conexão.

## Evidência e alcance

- O teste NEXUS `scripts/nexus/test-memora2-hmac-bound-084.ts` verifica SHA-256 independente, assinatura contendo grant/owner, alterações dos campos, ausência de cookie/token no cliente, limite de resposta e proibição de downgrade.
- No repositório privado Memora 2, os testes independentes da versão 084 verificam a assinatura e recusam proprietário/ID da autorização divergente **mesmo quando a assinatura é refeita com chave válida**.
- Teste HTTP integrado privado usa o cliente real NEXUS 084 pinado por SHA e o endpoint Memora 2 real transpilado, com dependências Cloudflare e reuniões **fictícias**. O teste não publica dados e não chama Cloudflare produtiva.

## Segurança residual: bloqueadores de ativação

- Essa assinatura comprova que **a requisição foi assinada por quem possui a chave** e estava vinculada às duas configurações de owner/grant; não comprova que uma pessoa natural é dona de ambas as contas.
- O login NEXUS é uma sessão JWT que não revalida necessariamente o ID/papel ativo no banco em cada requisição. O próximo gate deve revalidar o usuário, a concessão e a revogação em fonte confiável.
- Segredos e IDs internos somente em configuração segura de servidores. A identidade deve ser conciliada contra bases reais, sem publicá-la em GitHub/CI.
- O grant expira em até 30 dias e a revogação por configuração requer propagação para os dois ambientes; não há promessa de revogação instantânea.
- Service binding Cloudflare DO e Worker Memora 2 **não estão implantados** para esta função. Nada foi conectado às reuniões reais; o NEXUS demo continua impedido de consultá-las.
- Antes de qualquer stage/produção: revisar custos da conta Cloudflare, política de logs, replay/rate-limit em runtime, limites, escopo do proprietário, rollback, e solicitar autorização **separada** para instalar chaves e publicar.
- Não alterar a versão canônica da Memória Viva v18.0 com esse experimento.

## Repositórios e referências

- NEXUS: `Lucasom825/MarcFlow`, branch `nexus/memora2-hmac-bound-084-20261113`.
- Memora 2: `Lucasom825/memora-2-cloudflare`, branch `nexus/readiness-hmac-bound-084-20261113`.
- Último marco 083 aprovado: CI NEXUS https://github.com/Lucasom825/MarcFlow/actions/runs/43417675427 e CI Memora 2 https://github.com/Lucasom825/memora-2-cloudflare/actions/runs/43417758735.
