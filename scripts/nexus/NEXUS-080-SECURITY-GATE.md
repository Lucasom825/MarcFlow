# NEXUS 080 — controle de segurança da conexão com Memora 2

Data: 12/11/2026. Status: **ensaio experimental**, sem credenciais, sem deploy e sem merge.

## Entrega efetiva desta fase

O cliente NEXUS 078 não precisou ser alterado: ele já envia um nonce criptograficamente aleatório, timestamp e assinatura HMAC-SHA256. O bloqueio atômico foi corretamente colocado **na origem Memora 2**, após validação HMAC e antes de acessar o índice de reuniões.

Branches:
- Cliente NEXUS original: `nexus/memora2-read-bridge-078-20261112`, SHA `5f0fcdb802a47b7d6edb426a53ab7edf0759bbbe`.
- Projeto Memora 2 080: `Lucasom825/memora-2-cloudflare`, branch `nexus/readiness-security-080-20261112`.
- NEXUS 080: `nexus/memora2-security-contract-080-20261112`, derivada da documentação 079.

## Teste novo e resultado

GitHub Actions Memora 2 `#43297467444` SUCCESS: https://github.com/Lucasom825/memora-2-cloudflare/actions/runs/43297467444.

Foram aprovados 19 testes de CI, entre eles:
- autenticação real das bibliotecas e execução da **rota Memora Next.js por HTTP localhost**, com implementações fictícias de Cloudflare/NextResponse;
- 50 pedidos simultâneos com o mesmo nonce => **1 admissão, 49 replays recusados**;
- 11 requisições válidas distintas em 60 segundos => **10 admitidas, 11ª recusada (429)**;
- HMAC inválido => 401; proprietário incompatível e endpoint desativado => 404; ausência do controle => 503; POST => 405;
- nenhum dado privado (nome, erro, ID interno de reunião, caminho de PDF) é transmitido.

## Segurança e limites

O novo código servidor introduz um guard de nonce e rate limit projetado para um **Durable Object SQLite** usado exclusivamente por binding privado. Como esse binding ainda não foi criado no Memora 2 produtivo, a rota recusa a consulta caso ele não esteja presente.

**Nenhum recurso real do Memora 2 foi consultado e nenhum dado real foi gravado.**

Essa prova não é um deploy entre os dois produtos nem um teste de login/sessão real do NEXUS: as dependências Cloudflare/NextResponse são simuladas e a rede é apenas localhost. Não autoriza afirmar que a integração já funciona nos dois sites publicados.

Próximos gates:
1. Validar Durable Object e binding privados localmente com runtime Cloudflare simulado.
2. Auditoria das identidades do proprietário Memora 2 e conta NEXUS real; a sessão de demonstração continua bloqueada.
3. Revisar custos de Cloudflare, revogação, logging, limites e rollback.
4. Antes de qualquer segredo, alteração produtiva, deploy ou leitura de reuniões reais, pedir autorização específica.

## Política de custo

A Cloudflare oferece Durable Objects com SQLite no plano Free, com limites de uso. Em planos pagos, determinadas operações podem ser cobradas. Não ativar infraestrutura de cobrança sem checagem da conta e autorização.
Fonte: https://developers.cloudflare.com/durable-objects/platform/pricing/

PRs anteriores:
- https://github.com/Lucasom825/MarcFlow/pull/22
- https://github.com/Lucasom825/MarcFlow/pull/23
