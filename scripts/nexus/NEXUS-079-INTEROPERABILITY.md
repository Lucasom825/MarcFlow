# NEXUS 079 — teste integrado sintético com Memora 2

Data: 12/11/2026 (Brasília).
Estado: **apenas teste em branches experimentais; nenhuma credencial, leitura real, ativação ou alteração produtiva**.

## Teste desenvolvido
O teste verdadeiro entre as bibliotecas das duas pontas é executado **somente no runner privado do Memora 2**, no workflow `.github/workflows/nexus-079-synthetic-interop.yml` e script `scripts/test-nexus-memora-interop-079.mjs`.

A origem privada Memora 2 contém o verificador HMAC e o projetor de metadados. Esse runner obtém uma cópia somente-leitura do cliente NEXUS a partir do repositório público MarcFlow fixado no SHA `5f0fcdb802a47b7d6edb426a53ab7edf0759bbbe`, sem executar código de terceiros adicional em produção. **Código privado do Memora não é publicado no NEXUS.**

A fronteira HTTP é simulada em memória com objetos Request/Response. Exercita:
- Assinatura de GET real gerada pelo NEXUS e validada pelo Memora.
- Verificação de timestamp e rejeição de assinatura adulterada.
- Leitura de um inventário de reuniões fictícias com UUID fictício.
- Projeção de IDs opacos e remoção de nomes, erros, títulos, caminhos PDF.
- Parse da resposta pelo cliente NEXUS real e classificação correta dos quatro estados.
- Evidência de que nenhum código muda banco, workflow, credenciais, host de produção ou dados reais.

## Limitações que não podem ser ocultadas
- É um teste de interoperabilidade das bibliotecas e do formato HTTP, **não um teste de deploy entre dois serviços reais**.
- O endpoint Next.js/Cloudflare não é iniciado no teste, tampouco há autenticação real de usuário.
- O risco de replay dentro de 30 segundos continua porque nonces ainda não são persistidos. O teste mostra isso; não devemos afirmar que está resolvido.
- A associação de UUID do proprietário no Supabase/local auth requer revisão do ambiente antes de ativar.
- Ainda é preciso avaliar rate limits, isolamento entre usuários, revalidação de credenciais e segredos antes de uso produtivo.
- Continua proibido usar a conta NEXUS de demonstração para dados reais.

## Fluxo de aceitação
1. CI privado Memora 079 verde, com suíte sintética e testes do servidor 078.
2. CI NEXUS 078 verde, já comprovado em https://github.com/Lucasom825/MarcFlow/actions/runs/43292303817 .
3. Registrar IDs e SHAs completos dos workflows que passaram, sem alegar comunicação efetiva na nuvem.
4. Próximo experimento só em ambiente efêmero e com autorização separada para credenciais/deploy: fake storage, dois processos locais, rotas HTTP reais e teste de limites de segurança.

## Referências
- NEXUS 078: https://github.com/Lucasom825/MarcFlow/pull/22
- Memora 2 branch privada 079: https://github.com/Lucasom825/memora-2-cloudflare/tree/nexus/readiness-interop-079-20261112
- Histórico de investigação: https://github.com/Lucasom825/MarcFlow/pull/21
